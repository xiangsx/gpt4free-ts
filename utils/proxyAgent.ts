import axios, { AxiosError, AxiosInstance, CreateAxiosDefaults } from 'axios';
import HttpsProxyAgent from 'https-proxy-agent';
import puppeteer from 'puppeteer-extra';
import {
  Browser,
  BrowserContext,
  Device,
  Page,
  Protocol,
  PuppeteerLaunchOptions,
} from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import moment from 'moment';
import {
  BlockGoogleAnalysis,
  blockGoogleAnalysis,
  BlockPageSource,
  closeOtherPages,
  getRandomDevice,
  InterceptHandler,
  setPageInterception,
  simplifyPage,
} from './puppeteer';
import { v4 } from 'uuid';
import { PassThrough, pipeline } from 'stream';
import {
  ComError,
  getHostPortFromURL,
  getRandomOne,
  randomStr,
  randomUserAgent,
  sleep,
} from './index';
import { Config } from './config';
import { newInjectedPage } from 'fingerprint-injector';
import { FingerprintGenerator } from 'fingerprint-generator';
import path from 'path';
import fs, { createWriteStream } from 'fs';
import fileType from 'file-type';
import { promisify } from 'util';
import { io } from 'socket.io-client';
import { ManagerOptions } from 'socket.io-client/build/esm/manager';
import { Socket, SocketOptions } from 'socket.io-client/build/esm/socket';
import { puppeteerUserDirPool } from './pool';
import { AxiosInterceptorOptions, AxiosResponse } from 'axios/index';
const tunnel = require('tunnel');

export const getProxy = () => {
  let proxy = '';
  if (Config.config.proxy_pool?.enable) {
    proxy = getRandomOne(Config.config.proxy_pool.proxy_list);
  } else {
    proxy = process.env.http_proxy || '';
  }
  console.debug('use proxy: ', proxy);
  return proxy;
};

const reqProxy = (config: any) => {
  config.params = {
    ...config.params,
    target: (config.baseURL || '') + (config.url || ''),
  };
  config.baseURL = '';
  config.url = process.env.REQ_PROXY || '';
  return config;
};

export function CreateNewAxios(
  config: CreateAxiosDefaults,
  options?: {
    proxy?: string | boolean | undefined;
    errorHandler?: (error: AxiosError) => void;
    middleware?: (v: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;
  },
) {
  const { proxy, errorHandler, middleware } = options || {};
  const createConfig: CreateAxiosDefaults = { timeout: 15 * 1000, ...config };
  createConfig.proxy = false;
  if (proxy) {
    const realProxy = proxy === true ? getProxy() : proxy;
    const [host, port] = getHostPortFromURL(realProxy);
    createConfig.httpsAgent = tunnel.httpsOverHttp({
      proxy: {
        host,
        port,
      },
    });
    createConfig.httpAgent = tunnel.httpOverHttp({
      proxy: {
        host,
        port,
      },
    });
  }
  const instance = axios.create(createConfig);

  if (errorHandler) {
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        errorHandler(error);
        return Promise.reject(error);
      },
    );
  }
  if (middleware) {
    instance.interceptors.response.use(middleware);
  }

  return instance;
}

export function CreateAxiosProxy(
  config: CreateAxiosDefaults,
  useReqProxy = true,
  proxy = true,
  options?: { retry: boolean },
): AxiosInstance {
  const { retry = true } = options || {};
  const createConfig = { ...config };
  const useProxy = proxy ? getProxy() : '';
  createConfig.proxy = false;
  if (useProxy) {
    createConfig.httpAgent = HttpsProxyAgent(useProxy);
    createConfig.httpsAgent = HttpsProxyAgent(useProxy);
  }
  const client = axios.create(createConfig);
  const retryClient = axios.create(createConfig);
  if (useReqProxy && process.env.REQ_PROXY) {
    client.interceptors.request.use(
      (config) => {
        config.params = {
          ...config.params,
          target: (config.baseURL || '') + (config.url || ''),
        };
        config.baseURL = '';
        config.url = process.env.REQ_PROXY || '';
        return config;
      },
      (error) => {
        // 对请求错误做些什么
        return Promise.reject(error);
      },
    );
  }
  if (retry && process.env.RETRY === '1') {
    client.interceptors.response.use(
      undefined,
      function axiosRetryInterceptor(err) {
        // 如果请求失败并且重试次数少于一次，则重试
        if (err) {
          // 返回 axios 实例，进行一次新的请求
          console.log('axios failed, retrying!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          return retryClient(err.config);
        }

        // 如果失败且重试达到最大次数，将错误返回到用户
        return Promise.reject(err);
      },
    );
  }
  return client;
}

let globalBrowser: Browser;

type CreateNewPageReturn<T> = T extends true
  ? { page: Page; release: () => void }
  : Page;

export async function CreateNewPage<
  Params extends unknown[],
  Func extends (...args: Params) => unknown = (...args: Params) => unknown,
  T extends boolean | undefined = undefined,
>(
  url: string,
  options?: {
    emulate?: Device | boolean;
    stealth?: boolean;
    allowExtensions?: boolean;
    proxy?: string;
    args?: string[];
    simplify?: boolean;
    user_agent?: string;
    cookies?: Protocol.Network.CookieParam[];
    devtools?: boolean;
    fingerprint_inject?: boolean;
    protocolTimeout?: number;
    navigationTimeout?: number;
    recognize?: boolean;
    block_google_analysis?: boolean;
    interception_handlers?: InterceptHandler[];
    enable_user_cache?: T;
    inject_js?: [(...args: Params) => unknown, ...Params][];
  },
): Promise<CreateNewPageReturn<T>> {
  const {
    enable_user_cache = false,
    allowExtensions = false,
    proxy = getProxy(),
    args = [],
    simplify = true,
    cookies = [],
    user_agent = '',
    devtools = false,
    fingerprint_inject = false,
    protocolTimeout,
    navigationTimeout,
    stealth = true,
    recognize = true,
    block_google_analysis = false,
    emulate = false,
    inject_js = [],
    interception_handlers = [],
  } = options || {};
  const launchOpt: PuppeteerLaunchOptions = {
    headless: process.env.DEBUG === '1' ? false : 'new',
    devtools,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      ...args,
    ],
  };
  // 遍历run/extensions目录，加载所有扩展
  if (fs.existsSync('run/extensions')) {
    const exts = fs.readdirSync('run/extensions');
    for (const ext of exts) {
      const extPath = path.join('run/extensions', ext);
      if (fs.statSync(extPath).isDirectory()) {
        launchOpt.args?.push(`--load-extension=${extPath}`);
      }
    }
  }
  if (enable_user_cache) {
    const host = new URL(url).host;
    if (host) {
      launchOpt.userDataDir = puppeteerUserDirPool.popUserDir(host);
    }
  }
  if (protocolTimeout) {
    launchOpt.protocolTimeout = protocolTimeout;
  }
  launchOpt.args?.push(`--proxy-server=${proxy || getProxy()}`);
  let p = puppeteer;
  if (stealth) {
    p = p.use(StealthPlugin());
  }
  let browser: Browser | BrowserContext;
  if (recognize) {
    if (!globalBrowser || !globalBrowser.isConnected()) {
      globalBrowser = await p.launch(launchOpt);
    }
    browser = await globalBrowser.createIncognitoBrowserContext({
      proxyServer: proxy || getProxy(),
    });
  } else {
    browser = await p.launch(launchOpt);
  }
  try {
    const gen = new FingerprintGenerator();
    let page: Page;
    if (fingerprint_inject) {
      page = await newInjectedPage(browser as any);
    } else {
      page = await browser.newPage();
    }
    if (user_agent) {
      await page.setUserAgent(user_agent);
    }
    if (simplify) {
      interception_handlers.push(BlockPageSource);
    }
    if (block_google_analysis) {
      interception_handlers.push(BlockGoogleAnalysis);
    }
    if (interception_handlers.length) {
      await setPageInterception(page, interception_handlers);
    }
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    await page.setViewport({
      width: 1280 + Math.floor(Math.random() * 640),
      height: 720 + Math.floor(Math.random() * 360),
    });
    if (emulate) {
      if (typeof emulate === 'object' && user_agent in emulate) {
        await page.emulate(emulate);
      } else {
        await page.emulate(getRandomDevice());
      }
    }
    if (inject_js.length) {
      for (const js of inject_js) {
        await page.evaluateOnNewDocument(...js);
      }
    }
    if (enable_user_cache) {
      // 先清除cookie
      await page.deleteCookie(...(await page.cookies(url)));
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
      }
    }
    if (navigationTimeout) {
      page.setDefaultNavigationTimeout(navigationTimeout);
    }
    try {
      await page.goto(url);
      for (let p of await browser.pages()) {
        if (page !== p) {
          await p.close();
        }
      }
    } catch (e) {
      if (enable_user_cache && launchOpt.userDataDir) {
        puppeteerUserDirPool.releaseUserDir(launchOpt.userDataDir);
      }
      throw e;
    }
    if (recognize) {
      // @ts-ignore
      page.browser = page.browserContext;
    }
    if (enable_user_cache) {
      return {
        page,
        release: () => {
          page
            .browser()
            .close()
            .catch((err) => console.error(err.message));
          if (launchOpt.userDataDir) {
            puppeteerUserDirPool.releaseUserDir(launchOpt.userDataDir);
          }
        },
      } as any;
    }
    return page as any;
  } catch (e) {
    console.error(e);
    await browser.close();
    throw e;
  }
}

export async function CreateNewCachePage<
  Params extends unknown[],
  Func extends (...args: Params) => unknown = (...args: Params) => unknown,
>(
  url: string,
  options?: {
    emulate?: Device | boolean;
    stealth?: boolean;
    allowExtensions?: boolean;
    proxy?: string;
    args?: string[];
    simplify?: boolean;
    user_agent?: string;
    cookies?: Protocol.Network.CookieParam[];
    devtools?: boolean;
    fingerprint_inject?: boolean;
    protocolTimeout?: number;
    recognize?: boolean;
    block_google_analysis?: boolean;
    enable_user_cache?: boolean;
    inject_js?: [(...args: Params) => unknown, ...Params][];
  },
): Promise<{ page: Page; release: () => void }> {
  const {
    allowExtensions = false,
    proxy = getProxy(),
    args = [],
    simplify = true,
    cookies = [],
    user_agent = '',
    devtools = false,
    fingerprint_inject = false,
    protocolTimeout,
    stealth = true,
    recognize = true,
    block_google_analysis = false,
    emulate = false,
    inject_js = [],
    enable_user_cache = false,
  } = options || {};
  const launchOpt: PuppeteerLaunchOptions = {
    headless: process.env.DEBUG === '1' ? false : 'new',
    devtools,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      ...args,
    ],
  };
  if (enable_user_cache) {
    const host = new URL(url).host;
    if (host) {
      launchOpt.userDataDir = puppeteerUserDirPool.popUserDir(host);
    }
  }
  if (protocolTimeout) {
    launchOpt.protocolTimeout = protocolTimeout;
  }
  launchOpt.args?.push(`--proxy-server=${proxy || getProxy()}`);
  let p = puppeteer;
  if (stealth) {
    p = p.use(StealthPlugin());
  }
  let browser: Browser | BrowserContext;
  if (recognize) {
    if (!globalBrowser || !globalBrowser.isConnected()) {
      globalBrowser = await p.launch(launchOpt);
    }
    browser = await globalBrowser.createIncognitoBrowserContext({
      proxyServer: proxy || getProxy(),
    });
  } else {
    browser = await p.launch(launchOpt);
  }
  try {
    const gen = new FingerprintGenerator();
    let page: Page;
    if (fingerprint_inject) {
      page = await newInjectedPage(browser as any);
    } else {
      page = await browser.newPage();
    }
    if (user_agent) {
      await page.setUserAgent(user_agent);
    }
    if (simplify) {
      await simplifyPage(page);
    }
    if (block_google_analysis) {
      await blockGoogleAnalysis(page);
    }
    // 先清除cookie
    await page.deleteCookie();
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    await page.setViewport({
      width: 1000 + Math.floor(Math.random() * 1000),
      height: 1080,
    });
    if (emulate) {
      if (typeof emulate === 'object' && user_agent in emulate) {
        await page.emulate(emulate);
      } else {
        await page.emulate(getRandomDevice());
      }
    }
    if (inject_js.length) {
      for (const js of inject_js) {
        await page.evaluateOnNewDocument(...js);
      }
    }
    await page.goto(url);
    if (recognize) {
      // @ts-ignore
      page.browser = page.browserContext;
    }

    return {
      page,
      release: () => {
        page
          .browser()
          .close()
          .catch((err) => console.error(err.message));
        if (launchOpt.userDataDir) {
          puppeteerUserDirPool.releaseUserDir(launchOpt.userDataDir);
        }
      },
    };
  } catch (e) {
    console.error(e);
    await browser.close();
    if (launchOpt.userDataDir) {
      puppeteerUserDirPool.releaseUserDir(launchOpt.userDataDir);
    }
    throw e;
  }
}

export async function CreateNewPageWS(
  url: string,
  options?: {
    allowExtensions?: boolean;
    proxy?: string;
    args?: string[];
    simplify?: boolean;
    user_agent?: string;
    cookies?: Protocol.Network.CookieParam[];
    devtools?: boolean;
  },
) {
  const {
    allowExtensions = false,
    proxy = getProxy(),
    args = [],
    simplify = true,
    cookies = [],
    user_agent = '',
    devtools = false,
  } = options || {};
  const ws = await launchChromeAndFetchWsUrl();
  if (!ws) {
    throw new Error('launch chrome failed');
  }
  const browser = await puppeteer.connect({ browserWSEndpoint: ws });
  try {
    const page = await browser.newPage();
    if (user_agent) {
      await page.setUserAgent(user_agent);
    }
    if (simplify) {
      await simplifyPage(page);
    }
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url);
    return page;
  } catch (e) {
    console.error(e);
    await browser.close();
    throw e;
  }
}

export async function CreateNewBrowser() {
  const options: PuppeteerLaunchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
    ],
  };
  if (process.env.DEBUG === '1') {
    options.headless = false;
  }
  if (getProxy()) {
    options.args?.push(`--proxy-server=${getProxy()}`);
  }
  return await puppeteer.launch(options);
}

let pptPort = 19222 + Math.floor(Math.random() * 10000);

export function launchChromeAndFetchWsUrl(): Promise<string | null> {
  pptPort += 1;
  return new Promise((resolve, reject) => {
    const command = Config.config.global.chrome_path;
    if (!command) {
      reject(new Error('not config CHROME_PATH in env'));
    }
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--remote-debugging-port=${pptPort}`,
      '--remote-debugging-address=0.0.0.0',
      '--ignore-certificate-errors',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      // `--user-data-dir=${path.join(__dirname, `${randomStr(10)}`)}`,
    ];
    if (getProxy()) {
      args.push(`--proxy-server=${getProxy()}`);
    }
    if (process.env.DEBUG !== '1') {
      args.push('--headless=new');
    }

    const chromeProcess = spawn(command, args);

    chromeProcess.stderr.on('data', (data: Buffer) => {
      const output = data.toString();
      // Search for websocket URL
      const match = /ws:\/\/([a-zA-Z0-9\-\.]+):(\d+)\/([a-zA-Z0-9\-\/]+)/.exec(
        output,
      );
      if (match) {
        console.log('found ws link');
        resolve(match[0]); // Return the full WebSocket URL
      }
    });

    chromeProcess.on('error', (error) => {
      reject(error);
    });

    chromeProcess.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`chrome exited with code ${code}`));
      }
    });
  });
}

export class WSS {
  private ws: WebSocket;
  private cbMap: Record<number, Function> = {};

  constructor(
    target: string,
    callbacks?: {
      onOpen?: Function;
      onClose?: Function;
      onMessage?: (data: string) => void;
      onError?: Function;
    },
    options?: { proxy?: string; wssOptions?: WebSocket.ClientOptions },
  ) {
    const { onOpen, onClose, onMessage, onError } = callbacks || {};
    const { proxy = getProxy(), wssOptions } = options || {};
    // 创建一个代理代理
    const wsOptions: WebSocket.ClientOptions = {
      handshakeTimeout: 10 * 1000,
      ...wssOptions,
    };
    if (proxy) {
      wsOptions.agent = HttpsProxyAgent(proxy);
    }

    // 创建一个配置了代理的 WebSocket 客户端
    const ws = new WebSocket(target, wsOptions);

    ws.on('open', () => {
      onOpen && onOpen();
    });

    ws.on('close', () => {
      console.log('ws close');
      onClose && onClose();
    });

    ws.on('message', (data, isBinary) => {
      const str = data.toString('utf8');
      onMessage && onMessage(str);
      for (const cb of Object.values(this.cbMap)) {
        cb(str);
      }
    });
    ws.on('error', (err) => {
      console.log('ws error', err);
      onError && onError(err);
    });
    this.ws = ws;
  }

  send(data: string) {
    this.ws.send(data);
  }

  close() {
    this.ws.close();
  }

  onData(cb: (data: string) => void) {
    const key = moment().valueOf();
    this.cbMap[key] = cb;
    return () => {
      delete this.cbMap[key];
    };
  }
}

// export function fetchWithProxy(url: string, options?: RequestInit) {
//   const initOptions: RequestInit = {};
//   if (process.env.http_proxy) {
//     initOptions.agent = HttpsProxyAgent(process.env.http_proxy || '');
//   }
//   return fetch(url, { ...initOptions, ...options });
// }

export class WebFetchWithPage {
  private streamMap: Record<string, PassThrough> = {};
  private useCount = 0;

  constructor(private page: Page) {
    this.init().then(() => console.log(`web fetch with page init ok`));
  }

  public isUsing() {
    return this.useCount > 0;
  }

  public useEnd() {
    this.useCount -= 1;
  }

  getPage() {
    return this.page;
  }

  async close() {
    for (let i = 0; i <= 10; i++) {
      if (this.isUsing()) {
        console.log(
          `web fetch proxy is using,usecount:${this.useCount}, wait 5s`,
        );
        await sleep(5000);
        continue;
      }
      console.log(`web fetch proxy closed ok, usecount:${this.useCount}`);
      this.page?.browser().close();
      break;
    }
  }

  async init() {
    try {
      await this.page.exposeFunction('onChunk', (id: string, text: string) => {
        const stream = this.streamMap[id];
        if (stream) {
          stream.write(text);
        }
      });
      await this.page.exposeFunction('onChunkEnd', (id: string) => {
        const stream = this.streamMap[id];
        if (stream) {
          stream.end();
          delete this.streamMap[id];
        }
      });
      await this.page.exposeFunction(
        'onChunkError',
        (id: string, err: string) => {
          const stream = this.streamMap[id];
          if (stream) {
            console.log(`web fetch with page error: ${err}`);
            stream.write('data: [ERROR]\n\n', 'utf-8');
            delete this.streamMap[id];
          }
        },
      );
    } catch (e) {
      console.error('WebFetchProxy init failed, ', e);
    }
  }

  async fetch(url: string, init?: RequestInit) {
    if (!this.page) {
      throw new Error('please retry wait init');
    }
    const id = v4();
    const stream = new PassThrough();
    this.streamMap[id] = stream;
    this.useCount += 1;
    const data = (await this.page.evaluate(
      (id, url, init) => {
        return new Promise((resolve, reject) => {
          fetch(url, { ...init, redirect: 'error' })
            .then((response) => {
              if (!response.body) {
                resolve({ status: 500 });
                return null;
              }
              if (response.status !== 200) {
                response
                  .json()
                  .then((res) => {
                    return { status: response.status, ...res };
                  })
                  .then(resolve);
                return null;
              }
              resolve({ status: 200 });
              const reader = response.body.getReader();
              const newDelay = () =>
                setTimeout(() => {
                  // @ts-ignore
                  window.onChunkError(id, 'timeout');
                }, 60 * 1000);
              let delay = newDelay();
              const refresh = () => {
                clearTimeout(delay);
                delay = newDelay();
              };

              function readNextChunk() {
                reader
                  .read()
                  .then(({ done, value }) => {
                    refresh();
                    const textChunk = new TextDecoder('utf-8').decode(value);
                    if (done) {
                      // @ts-ignore
                      window.onChunkEnd(id);
                      // @ts-ignore
                      return;
                    }
                    // @ts-ignore
                    window.onChunk(id, textChunk);
                    readNextChunk();
                  })
                  .catch((err) => {
                    // @ts-ignore
                    window.onChunkError(id, err.message);
                  });
              }

              readNextChunk();
            })
            .catch((err) => {
              console.error(err);
              resolve({ status: err.response.status, message: err.message });
            });
        });
      },
      id,
      url,
      init,
    )) as { status: number; [key: string]: any };
    if (data.status !== 200) {
      const failedMsg = `fetch failed ${JSON.stringify({ url, init, data })}`;
      console.error(failedMsg);
      throw new ComError(
        `fetch failed: ${JSON.stringify({ url, data })}`,
        data.status,
        data,
      );
    }

    return stream;
  }
}

export class WebFetchProxy {
  private page?: Page;
  private streamMap: Record<string, PassThrough> = {};
  private readonly homeURL: string;
  private options: { cookie: Protocol.Network.CookieParam[] } | undefined;
  private useCount = 0;

  constructor(
    homeURL: string,
    options?: { cookie: Protocol.Network.CookieParam[] },
  ) {
    this.homeURL = homeURL;
    this.options = options;
    this.init().then(() => console.log(`web fetch proxy init ok`));
  }

  public isUsing() {
    return this.useCount > 0;
  }

  public useEnd() {
    this.useCount -= 1;
  }

  getPage() {
    return this.page;
  }

  async close() {
    for (let i = 0; i <= 10; i++) {
      if (this.isUsing()) {
        console.log(
          `web fetch proxy is using,usecount:${this.useCount}, wait 5s`,
        );
        await sleep(5000);
        continue;
      }
      console.log(`web fetch proxy closed ok, usecount:${this.useCount}`);
      this.page?.browser().close();
      break;
    }
  }

  async init() {
    try {
      const options: PuppeteerLaunchOptions = {
        headless: process.env.DEBUG === '1' ? false : 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
        ],
      };
      if (getProxy()) {
        options.args?.push(`--proxy-server=${getProxy()}`);
      }
      const browser = await puppeteer.launch(options);
      this.page = await browser.newPage();
      if (this.options?.cookie && this.options.cookie.length > 0) {
        await this.page.setCookie(...this.options.cookie);
      }
      await this.page.goto(this.homeURL);
      await closeOtherPages(browser, this.page);
      await this.page.exposeFunction('onChunk', (id: string, text: string) => {
        const stream = this.streamMap[id];
        if (stream) {
          stream.write(text);
        }
      });
      await this.page.exposeFunction('onChunkEnd', (id: string) => {
        const stream = this.streamMap[id];
        if (stream) {
          stream.end();
          delete this.streamMap[id];
        }
      });
      await this.page.exposeFunction(
        'onChunkError',
        (id: string, err: string) => {
          const stream = this.streamMap[id];
          if (stream) {
            stream.emit('error', err);
            delete this.streamMap[id];
          }
        },
      );
    } catch (e) {
      console.error('WebFetchProxy init failed, ', e);
    }
  }

  async fetch(url: string, init?: RequestInit) {
    if (!this.page) {
      throw new Error('please retry wait init');
    }
    const id = v4();
    const stream = new PassThrough();
    this.streamMap[id] = stream;
    this.useCount += 1;
    this.page.evaluate(
      (id, url, init) => {
        return new Promise((resolve, reject) => {
          fetch(url, init)
            .then((response) => {
              if (!response.body) {
                resolve(null);
                return null;
              }
              const reader = response.body.getReader();

              function readNextChunk() {
                reader
                  .read()
                  .then(({ done, value }) => {
                    const textChunk = new TextDecoder('utf-8').decode(value);
                    if (done) {
                      // @ts-ignore
                      window.onChunkEnd(id);
                      // @ts-ignore
                      resolve(textChunk);
                      return;
                    }
                    // @ts-ignore
                    window.onChunk(id, textChunk);
                    readNextChunk();
                  })
                  .catch((err) => {
                    // @ts-ignore
                    window.onChunkError(id, err.message);
                    reject(err);
                  });
              }

              readNextChunk();
            })
            .catch((err) => {
              console.error(err);
              reject(err);
            });
        });
      },
      id,
      url,
      init,
    );
    return stream;
  }
}

const pipelinePromisified = promisify(pipeline);

export function getDownloadClient(local: boolean) {
  if (local) {
    return CreateNewAxios({ timeout: 5 * 1000 }, { proxy: false });
  } else {
    return CreateNewAxios(
      { timeout: 5 * 1000 },
      {
        proxy:
          getRandomOne(
            Config.config.global.download.proxy_list ||
              Config.config.proxy_pool.proxy_list,
          ) || false,
      },
    );
  }
}

export async function downloadImageToBase64(fileUrl: string): Promise<{
  base64Data: string;
  mimeType: string;
}> {
  let local = false;
  if (Config.config.global.download_map) {
    for (const old in Config.config.global.download_map) {
      fileUrl = fileUrl.replace(old, Config.config.global.download_map[old]);
      local = true;
      if (fileUrl.startsWith('http:')) {
        local = true;
      }
    }
  }
  try {
    let tempFilePath = path.join('run/file', v4());
    let ok = false;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await getDownloadClient(local || i === 2).get(
          fileUrl,
          {
            responseType: 'stream',
            headers: {
              'User-Agent': randomUserAgent(),
            },
            timeout: 5 * 1000,
          },
        );
        let writer = createWriteStream(tempFilePath);
        await pipelinePromisified(response.data, writer);
        ok = true;
      } catch (e: any) {
        console.warn(`download ${fileUrl} failed:${e.message}, retry ${i}`);
      }
    }
    if (!ok) {
      throw new ComError(`download failed`, ComError.Status.BadRequest);
    }
    const base64Data = fs.readFileSync(tempFilePath).toString('base64');
    return {
      base64Data,
      mimeType: (await fileType.fromFile(tempFilePath))?.mime || 'image/jpeg',
    };
  } catch (e: any) {
    console.error(e.message);
    throw e;
  }
}

export function CreateSocketIO(
  url: string,
  options?: Partial<
    ManagerOptions & SocketOptions & { proxy?: boolean | string }
  >,
): Socket {
  const { proxy, ...opts } = options || {};

  const opt = {
    transports: ['websocket'],
    ...opts,
  };
  if (proxy) {
    if (typeof proxy === 'string') {
      // @ts-ignore
      opt.agent = HttpsProxyAgent(proxy);
    } else {
      // @ts-ignore
      opt.agent = HttpsProxyAgent(getProxy());
    }
  }
  return io(url, opt);
}
