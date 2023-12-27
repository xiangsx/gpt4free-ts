import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import HttpsProxyAgent from 'https-proxy-agent';
import { SessionConstructorOptions } from 'tls-client/dist/esm/types';
import { Session } from 'tls-client/dist/esm/sessions';
import tlsClient from 'tls-client';
import puppeteer from 'puppeteer-extra';
import { Browser, Page, Protocol, PuppeteerLaunchOptions } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import moment from 'moment';
import { closeOtherPages, simplifyPage } from './puppeteer';
import { v4 } from 'uuid';
import { PassThrough, pipeline } from 'stream';
import {
  ComError,
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
import sizeOf from 'image-size';
import { promisify } from 'util';

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
  options?: { proxy: string | boolean },
) {
  const { proxy = true } = options || {};
  const createConfig = { ...config };
  if (proxy) {
    const realProxy = proxy === true ? getProxy() : proxy;
    createConfig.proxy = false;
    createConfig.httpAgent = HttpsProxyAgent(realProxy);
    createConfig.httpsAgent = HttpsProxyAgent(realProxy);
  }
  return axios.create(createConfig);
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

export function CreateTlsProxy(
  config: SessionConstructorOptions,
  proxy?: string,
): Session {
  const client = new tlsClient.Session(config);
  const useProxy = getProxy() || proxy;
  if (useProxy) {
    client.proxy = useProxy;
  }
  return client;
}

let globalBrowser: Browser;

export async function CreateNewPage(
  url: string,
  options?: {
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
    fingerprint_inject = false,
    protocolTimeout,
    stealth = true,
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
  if (protocolTimeout) {
    launchOpt.protocolTimeout = protocolTimeout;
  }
  if (proxy) {
    launchOpt.args?.push(`--proxy-server=${proxy}`);
  }
  let p = puppeteer;
  if (stealth) {
    p = p.use(StealthPlugin());
  }
  if (!globalBrowser || !globalBrowser.isConnected()) {
    globalBrowser = await p.launch(launchOpt);
  }
  const browser = await globalBrowser.createIncognitoBrowserContext();
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
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    await page.setViewport({
      width: 1000 + Math.floor(Math.random() * 1000),
      height: 1080,
    });
    await page.goto(url);
    // @ts-ignore
    page.browser = page.browserContext;
    return page;
  } catch (e) {
    console.error(e);
    await browser.close();
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
  ) {
    const { onOpen, onClose, onMessage, onError } = callbacks || {};
    // 创建一个代理代理
    const wsOptions: WebSocket.ClientOptions = {};
    if (getProxy()) {
      wsOptions.agent = HttpsProxyAgent(getProxy());
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
            stream.end();
            stream.destroy();
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
          fetch(url, init)
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
                }, 30 * 1000);
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
              reject(err);
            });
        });
      },
      id,
      url,
      init,
    )) as { status: number; [key: string]: any };
    if (data.status !== 200) {
      throw new ComError('fetch failed', data.status, data);
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

export async function downloadImageToBase64(fileUrl: string): Promise<{
  base64Data: string;
  mimeType: string;
}> {
  if (Config.config.global.download_map) {
    for (const old in Config.config.global.download_map) {
      fileUrl = fileUrl.replace(old, Config.config.global.download_map[old]);
    }
  }
  try {
    let tempFilePath = path.join('run/file', v4());
    let ok = false;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await CreateNewAxios(
          {},
          { proxy: getRandomOne(Config.config.proxy_pool.stable_proxy_list) },
        ).get(fileUrl, {
          responseType: 'stream',
          headers: {
            'User-Agent': randomUserAgent(),
          },
        });
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
