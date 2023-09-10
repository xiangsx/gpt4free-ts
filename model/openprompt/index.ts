import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, Page, Protocol } from 'puppeteer';
import { BrowserPool, BrowserUser } from '../../utils/puppeteer';
import {
  CreateEmail,
  TempEmailType,
  TempMailMessage,
} from '../../utils/emailFactory';
import * as fs from 'fs';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
  randomStr,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';
import moment from 'moment';
import { AxiosInstance, AxiosRequestConfig } from 'axios';
import es from 'event-stream';
import { CreateAxiosProxy } from '../../utils/proxyAgent';

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time?: string;
  password?: string;
  cookie: Protocol.Network.Cookie[];
  useTimes: number;
};

type RealReq = {
  copilot_id: number;
  query: string;
};

class OpenPromptAccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_openprompt.json';
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

export class OpenPrompt extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: OpenPromptAccountPool;
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new OpenPromptAccountPool();
    let maxSize = +(process.env.OEPNPROMPT_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this, false);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://openprompt.co/api',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        },
      },
      true,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5_16k:
        return 11000;
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

  public static async newChat(page: Page) {
    await page.goto(`https://openprompt.co/api`);
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
      await page.setViewport({ width: 1920, height: 1080 });
      if (account.cookie?.length > 0) {
        await page.setCookie(...account.cookie);
        await page.goto('https://openprompt.co/');
        if (await this.ifLogin(page)) {
          setTimeout(() => browser.close().catch(), 1000);
          return [page, account];
        }
      }

      await page.goto('https://openprompt.co/');
      // await OpenPrompt.skipIntro(page);
      await page.waitForSelector('.mx-auto > .flex > .flex > a > .rounded-md');
      await page.click('.mx-auto > .flex > .flex > a > .rounded-md');

      await page.waitForSelector(
        'div > #auth-sign-in > .supabase-auth-ui_ui-container > .supabase-auth-ui_ui-container > .supabase-auth-ui_ui-anchor:nth-child(2)',
      );
      await page.click(
        'div > #auth-sign-in > .supabase-auth-ui_ui-container > .supabase-auth-ui_ui-container > .supabase-auth-ui_ui-anchor:nth-child(2)',
      );

      await page.waitForSelector('#email');
      await page.click('#email');

      const emailBox = CreateEmail(
        (process.env.EMAIL_TYPE as TempEmailType) || TempEmailType.TempMailLOL,
      );
      const emailAddress = await emailBox.getMailAddress();
      account.email = emailAddress;
      this.accountPool.syncfile();
      // 将文本键入焦点元素
      await page.keyboard.type(emailAddress, { delay: 10 });

      account.password = randomStr(10);
      await page.waitForSelector('#password');
      await page.click('#password');
      await page.keyboard.type(account.password, { delay: 10 });

      // signup
      await page.waitForSelector(
        '.sm\\:mx-auto > div > #auth-sign-up > .supabase-auth-ui_ui-container > .supabase-auth-ui_ui-button',
      );
      await page.click(
        '.sm\\:mx-auto > div > #auth-sign-up > .supabase-auth-ui_ui-container > .supabase-auth-ui_ui-button',
      );

      const msgs = (await emailBox.waitMails()) as TempMailMessage[];
      let validateURL: string | undefined;
      for (const msg of msgs) {
        validateURL = msg.content.match(/https:\/\/[^"]*/i)?.[0];
        if (validateURL) {
          break;
        }
      }
      if (!validateURL) {
        throw new Error('Error while obtaining verfication URL!');
      }
      validateURL = validateURL.replace(/amp;/g, '');
      await page.goto(validateURL);
      await sleep(3000);
      await page.reload();
      const ok = await this.ifLogin(page);
      if (!ok) {
        throw new Error('openprompt login failed');
      }
      account.cookie = await page.cookies('https://openprompt.co/');
      this.accountPool.syncfile();
      setTimeout(() => browser.close().catch(), 1000);
      this.logger.info('register openprompt successfully');
      return [page, account];
    } catch (e: any) {
      this.logger.warn('something error happened,err:', e);
      return [] as any;
    }
  }

  public async ifLogin(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector('.relative > div > * > .inline-flex > .w-6', {
        timeout: 10 * 1000,
      });
      this.logger.info('still login in');
      return true;
    } catch (e: any) {
      return false;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page || !account.cookie || account.cookie.length === 0) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data = {
      messages: req.messages,
      model: 'gpt-3.5-turbo-16k',
    };
    try {
      account.useTimes += 1;
      this.accountPool.syncfile();
      const res = await this.client.post('/chat2', data, {
        responseType: 'stream',
        headers: {
          Cookie: account.cookie
            .map((item) => `${item.name}=${item.value}`)
            .join('; '),
        },
      } as AxiosRequestConfig);
      res.data.pipe(
        es.map(async (chunk: any, cb: any) => {
          const res = chunk.toString();
          if (!res) {
            return;
          }
          stream.write(Event.message, { content: res || '' });
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        if (account.useTimes >= 10) {
          destroy();
        } else {
          done(account);
        }
      });
    } catch (e: any) {
      this.logger.error('openprompt ask stream failed, err', e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
      done(account);
    }
  }
}
