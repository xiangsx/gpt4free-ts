import normalPPT, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import * as fs from 'fs';
import { ComError, shuffleArray, sleep } from './index';
import { launchChromeAndFetchWsUrl } from './proxyAgent';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

export interface PageInfo<T> {
  id: string;
  ready: boolean;
  page?: Page;
  data?: T;
  ws?: string;
}

export type PrepareOptions = {
  waitDisconnect: (delay: number) => Promise<Browser>;
};

type PrepareFunc<T> = (
  id: string,
  browser: Browser,
  options?: PrepareOptions,
) => Promise<[Page | undefined, T]>;

export interface BrowserUser<T> {
  init: PrepareFunc<T>;
  newID: () => string;
  deleteID: (id: string) => void;
  release?: (id: string) => void;
}

export class BrowserPool<T> {
  private readonly pool: PageInfo<T>[] = [];
  private readonly size: number;
  private readonly user: BrowserUser<T>;
  private savefile: boolean;
  private poolDelay: number;
  private useConnect: boolean;

  constructor(
    size: number,
    user: BrowserUser<T>,
    saveFile: boolean = true,
    poolDelay: number = 5 * 1000,
    useConnect: boolean = false,
  ) {
    this.size = size;
    this.user = user;
    this.savefile = saveFile;
    this.poolDelay = poolDelay;
    this.useConnect = useConnect;
    this.init();
  }

  async init() {
    for (let i = 0; i < this.size; i++) {
      const id = this.user.newID();
      const info: PageInfo<T> = {
        id,
        ready: false,
      };
      this.pool.push(info);
      if (this.poolDelay === -1) {
        await this.initOne(id);
      } else {
        this.initOne(id).then();
      }
      if (this.poolDelay > 0) {
        await sleep(this.poolDelay);
      }
    }
  }

  find(id: string): PageInfo<T> | undefined {
    for (const info of this.pool) {
      if (info.id === id) {
        return info;
      }
    }
  }

  async initOne(id: string): Promise<void> {
    const info = this.find(id);
    if (!info) {
      console.error('init one failed, not found info');
      return;
    }
    const options: PuppeteerLaunchOptions = {
      headless: process.env.DEBUG === '1' ? false : 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
      ],
      userDataDir: this.savefile ? `run/${info.id}` : undefined,
    };
    if (process.env.http_proxy) {
      options.args?.push(`--proxy-server=${process.env.http_proxy}`);
    }
    let browser: Browser;
    try {
      let page: Page | undefined, data: T;
      if (this.useConnect) {
        if (!process.env.CHROME_PATH) {
          throw new Error('not config CHROME_PATH');
        }
        const wsLink = await launchChromeAndFetchWsUrl();
        if (!wsLink) {
          throw new Error('launch chrome failed');
        }
        console.log('got: ', wsLink);
        browser = await normalPPT.connect({ browserWSEndpoint: wsLink });
        info.ws = wsLink;
        [page, data] = await this.user.init(info.id, browser, {
          waitDisconnect: async (delay) => {
            browser.disconnect();
            await sleep(delay);
            browser = await normalPPT.connect({ browserWSEndpoint: wsLink });
            await sleep(1000);
            return browser;
          },
        });
      } else {
        browser = await puppeteer.launch(options);
        [page, data] = await this.user.init(info.id, browser);
      }
      if (!page) {
        this.user.deleteID(info.id);
        const newID = this.user.newID();
        console.warn(`init ${info.id} failed, delete! init new ${newID}`);
        await browser.close();
        if (options.userDataDir) {
          fs.rm(options.userDataDir, { force: true, recursive: true }, () => {
            console.log(`${info.id} has been deleted`);
          });
        }
        await sleep(5000);
        info.id = newID;
        return await this.initOne(info.id);
      }
      info.page = page;
      info.data = data;
      info.ready = true;
    } catch (e: any) {
      // @ts-ignore
      if (browser) {
        await browser.close();
      }
      console.error('init one failed, err:', e);
      this.user.deleteID(info.id);
      const newID = this.user.newID();
      console.warn(`init ${info.id} failed, delete! init new ${newID}`);
      if (options.userDataDir) {
        fs.rm(options.userDataDir, { force: true, recursive: true }, () => {
          console.log(`${info.id} has been deleted`);
        });
      }
      await sleep(5000);
      info.id = newID;
      return await this.initOne(info.id);
    }
  }

  deleteIDFile(id: string) {
    fs.rm(`run/${id}`, { force: true, recursive: true }, () => {
      console.log(`${id} has been deleted`);
    });
  }

  //@ts-ignore
  get(): [
    page: Page | undefined,
    data: T | undefined,
    done: (data: T) => void,
    destroy: (
      force?: boolean,
      notCreate?: boolean,
      randomSleep?: number,
    ) => void,
  ] {
    for (const item of shuffleArray(this.pool)) {
      if (item.ready) {
        item.ready = false;
        return [
          item.page,
          item.data,
          (data: T) => {
            item.ready = true;
            item.data = data;
          },
          async (
            force: boolean = false,
            notCreate: boolean = false,
            randomSleep: number = 0,
          ) => {
            if (!item.page?.isClosed()) {
              item.page?.close();
            }
            if (randomSleep) {
              const misec = Math.floor(Math.random() * randomSleep);
              console.log(`random wait ${misec}`);
              await sleep(misec);
            }
            this.user.release?.(item.id);
            if (force) {
              this.user.deleteID(item.id);
              this.deleteIDFile(item.id);
            }
            if (!notCreate) {
              item.id = this.user.newID();
              this.initOne(item.id).then();
            }
          },
        ];
      }
    }
    throw new ComError(
      'no connection available',
      ComError.Status.RequestTooMany,
    );
  }
}

export async function closeOtherPages(browser: Browser, page: Page) {
  const pages = await browser.pages();
  for (let i = 0; i < pages.length; i++) {
    // 如果不是当前页面，就关闭
    if (pages[i] !== page) {
      await pages[i].close();
    }
  }
}

export async function simplifyPage(page: Page) {
  await page.setRequestInterception(true);
  const blockTypes = new Set([
    'image',
    'media',
    'font',
    'ping',
    'cspviolationreport',
  ]);
  page.on('request', (req) => {
    if (blockTypes.has(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

export async function simplifyPageAll(page: Page) {
  await page.setRequestInterception(true);
  const blockTypes = new Set([
    'image',
    'media',
    'font',
    'ping',
    'cspviolationreport',
    'stylesheet',
    'websocket',
    'manifest',
  ]);
  page.on('request', (req) => {
    if (blockTypes.has(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
}
