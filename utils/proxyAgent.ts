import axios, { AxiosInstance, CreateAxiosDefaults } from 'axios';
import HttpsProxyAgent from 'https-proxy-agent';
import { SessionConstructorOptions } from 'tls-client/dist/esm/types';
import { Session } from 'tls-client/dist/esm/sessions';
import tlsClient from 'tls-client';
import puppeteer from 'puppeteer-extra';
import { PuppeteerLaunchOptions } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { spawn } from 'child_process';
import path from 'path';
import { randomStr } from './index';

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
  if (useProxy) {
    createConfig.proxy = false;
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
      `--user-data-dir=${path.join(__dirname, `${randomStr(10)}`)}`,
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
