import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import HttpsProxyAgent from 'https-proxy-agent';
import { SessionConstructorOptions } from 'tls-client/dist/esm/types';
import { Session } from 'tls-client/dist/esm/sessions';
import tlsClient from 'tls-client';
import puppeteer from 'puppeteer-extra';
import { Page, PuppeteerLaunchOptions } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import moment from 'moment';
import { closeOtherPages } from './puppeteer';
import { v4 } from 'uuid';
import { PassThrough } from 'stream';

puppeteer.use(StealthPlugin());

const reqProxy = (config: any) => {
  config.params = {
    ...config.params,
    target: (config.baseURL || '') + (config.url || ''),
  };
  config.baseURL = '';
  config.url = process.env.REQ_PROXY || '';
  return config;
};

export function CreateAxiosProxy(
  config: CreateAxiosDefaults,
  useReqProxy = true,
  proxy = true,
  options?: { retry: boolean },
): AxiosInstance {
  const { retry = true } = options || {};
  const createConfig = { ...config };
  const useProxy = proxy ? process.env.http_proxy : '';
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
  const useProxy = process.env.http_proxy || proxy;
  if (useProxy) {
    client.proxy = useProxy;
  }
  return client;
}

export async function CreateNewPage(
  url: string,
  options?: { allowExtensions?: boolean; proxy?: string; args?: string[] },
) {
  const {
    allowExtensions = false,
    proxy = process.env.http_proxy,
    args = [],
  } = options || {};
  const browser = await puppeteer.launch({
    headless: process.env.DEBUG === '1' ? false : 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--proxy-server=${proxy}`,
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      ...args,
    ],
  } as PuppeteerLaunchOptions);
  const page = await browser.newPage();
  await page.goto(url);
  await page.setViewport({ width: 1920, height: 1080 });
  return page;
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
  if (process.env.http_proxy) {
    options.args?.push(`--proxy-server=${process.env.http_proxy}`);
  }
  return await puppeteer.launch(options);
}

let pptPort = 19222 + Math.floor(Math.random() * 10000);
export function launchChromeAndFetchWsUrl(): Promise<string | null> {
  pptPort += 1;
  return new Promise((resolve, reject) => {
    const command = `${process.env.CHROME_PATH}`;
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
    if (process.env.http_proxy) {
      args.push(`--proxy-server=${process.env.http_proxy}`);
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
    if (process.env.http_proxy) {
      wsOptions.agent = HttpsProxyAgent(process.env.http_proxy || '');
    }

    // 创建一个配置了代理的 WebSocket 客户端
    const ws = new WebSocket(target, wsOptions);

    ws.on('open', () => {
      console.log('ws open');
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

export class WebFetchProxy {
  private page?: Page;
  private streamMap: Record<string, PassThrough> = {};
  private readonly homeURL: string;
  constructor(homeURL: string) {
    this.homeURL = homeURL;
    this.init().then(() => console.log(`web fetch proxy init ok`));
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
      if (process.env.http_proxy) {
        options.args?.push(`--proxy-server=${process.env.http_proxy}`);
      }
      const browser = await puppeteer.launch(options);
      this.page = await browser.newPage();
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

    this.page
      .evaluate(
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
                      window.onChunkError(id, err);
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
      )
      .catch(console.error);
    return stream;
  }
}
