import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Browser, Page, Protocol } from 'puppeteer';
import { BrowserPool, BrowserUser } from '../../utils/puppeteer';
import * as fs from 'fs';
import {
  Event,
  EventStream,
  parseJSON,
  randomUserAgent,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';
import moment from 'moment';
import { AxiosInstance, AxiosRequestConfig } from 'axios';
import es from 'event-stream';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { CreateAxiosDefaults } from 'axios/index';

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time?: string;
  password?: string;
  cookie: Protocol.Network.Cookie[];
  token: string;
  useTimes: number;
};

interface RealReq {
  question: string;
  chat_id: string;
  timestamp: number;
  token: string;
}

class AccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_demochat.json';
  private using = new Set<string>();

  constructor() {
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, [] as Account[]);
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
  }

  public syncfile() {
    fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
  }

  public getByID(id: string) {
    for (const item of this.pool) {
      if (item.id === id) {
        return item;
      }
    }
  }

  public delete(id: string) {
    this.pool = this.pool.filter((item) => item.id !== id);
    this.syncfile();
  }

  public get(): Account {
    const now = moment();
    for (const item of this.pool) {
      if (
        (item.useTimes < 10 ||
          moment(item.last_use_time).isBefore(
            moment().subtract(1, 'd').subtract(2, 'h'),
          )) &&
        !this.using.has(item.id)
      ) {
        console.log(`find old login account:`, JSON.stringify(item));
        item.last_use_time = now.format(TimeFormat);
        this.syncfile();
        this.using.add(item.id);
        return item;
      }
    }
    const newAccount: Account = {
      id: v4(),
      last_use_time: now.format(TimeFormat),
      cookie: [],
      useTimes: 0,
      token: '',
    };
    this.pool.push(newAccount);
    this.syncfile();
    this.using.add(newAccount.id);
    return newAccount;
  }

  public multiGet(size: number): Account[] {
    const result: Account[] = [];
    for (let i = 0; i < size; i++) {
      result.push(this.get());
    }
    return result;
  }
}

export class ChatDemo extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;
  private client: AxiosInstance;
  private useragent: string = randomUserAgent();

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    let maxSize = +(process.env.DEMOCHAT_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this, false);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://chat.chatgptdemo.net',
        headers: {
          'Content-Type': 'application/json',
          accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
          Referer: 'https://chat.chatgptdemo.net/',
          Origin: 'https://chat.chatgptdemo.net',
        },
      } as CreateAxiosDefaults,
      true,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.GPT3p5_16k:
        return 3000;
      default:
        return 0;
    }
  }

  deleteID(id: string): void {
    this.accountPool.delete(id);
  }

  newID(): string {
    const account = this.accountPool.get();
    return account.id;
  }

  async init(
    id: string,
    browser: Browser,
  ): Promise<[Page | undefined, Account]> {
    const account = this.accountPool.getByID(id);
    try {
      if (!account) {
        throw new Error('account undefined, something error');
      }
      const [page] = await browser.pages();
      await page.setUserAgent(this.useragent);

      await page.goto('https://chat.chatgptdemo.net/');
      await sleep(2000);
      account.cookie = await page.cookies('https://chat.chatgptdemo.net');
      if (account.cookie.length === 0) {
        throw new Error('demochat got cookie failed');
      }
      await this.closePOP(page);
      account.token = await this.getToken(page);
      this.accountPool.syncfile();
      this.logger.info('register demochat successfully');
      return [page, account];
    } catch (e: any) {
      this.logger.warn('something error happened,err:', e.message);
      return [] as any;
    }
  }

  public async closePOP(page: Page) {
    await page.evaluate(
      () =>
        // @ts-ignore
        (document.querySelector(
          '#ADS-block-detect > div.ads-block-popup',
          // @ts-ignore
        ).style.display = 'none'),
    );
    // @ts-ignore
    await page.evaluate(
      () =>
        // @ts-ignore
        (document.querySelector(
          '#ADS-block-detect > div.overlay',
          // @ts-ignore
        ).style.display = 'none'),
    );
  }

  public async getToken(page: Page) {
    // @ts-ignore
    const token: string = await page.evaluate(() => $('#TTT').text());
    return token;
  }

  public async getChatID(page: Page) {
    const chatid: string = await page.evaluate(() =>
      // @ts-ignore
      $('.chatbox-item.focused').attr('id'),
    );
    return chatid;
  }

  public async newChat(page: Page) {
    await page.waitForSelector(
      '.app > #main-menu > .main > .button-container > .button',
    );
    await page.click('.app > #main-menu > .main > .button-container > .button');
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page || !account.cookie || account.cookie.length === 0) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data: RealReq = {
      question: req.prompt,
      chat_id: await this.getChatID(page),
      timestamp: moment().valueOf(),
      token: account.token,
    };
    try {
      account.useTimes += 1;
      this.accountPool.syncfile();
      const res = await this.client.post('/chat_api_stream', data, {
        responseType: 'stream',
        headers: {
          Cookie: account.cookie
            .map((item) => `${item.name}=${item.value}`)
            .join('; '),
        },
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            stream.write(Event.error, { error: 'not found data.choices' });
            stream.end();
            return;
          }
          const [
            {
              delta: { content = '' },
              finish_reason,
            },
          ] = data.choices;
          if (finish_reason === 'stop') {
            return;
          }
          stream.write(Event.message, { content });
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        this.newChat(page);
        done(account);
      });
    } catch (e: any) {
      this.logger.error('demochat ask stream failed, err', e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
      await this.newChat(page);
      destroy(true);
    }
  }
}
