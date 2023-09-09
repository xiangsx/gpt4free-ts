import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, Page } from 'puppeteer';
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

const MaxGptTimes = 500;

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time?: string;
  password?: string;
  gpt4times: number;
  auth_key?: string;
};

type RealReq = {
  copilot_id: number;
  query: string;
};

class CopilotAccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_copilot.json';
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
      if (item.gpt4times + 15 <= MaxGptTimes && !this.using.has(item.id)) {
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
      gpt4times: 0,
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

export class Copilot extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: CopilotAccountPool;
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new CopilotAccountPool();
    let maxSize = +(process.env.COPILOT_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this, false);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://api.pipe3.xyz/api',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        },
      },
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 3000;
      default:
        return 0;
    }
  }

  private static async closeWelcomePop(page: Page) {
    try {
      await page.waitForSelector(
        'div > div > button > .semi-typography > strong',
        { timeout: 10 * 1000 },
      );
      await page.click('div > div > button > .semi-typography > strong');
    } catch (e: any) {
      console.log('not need close welcome pop');
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
    await page.goto(`https://app.copilothub.ai/chat?id=5323`);
  }

  private static async getAuthKey(page: Page): Promise<string> {
    const req = await page.waitForRequest(
      (res) => res.url().indexOf('/copilot/config/list') !== -1,
    );
    return req.headers()['authorization'];
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
      await Copilot.newChat(page);
      if (account.auth_key) {
        setTimeout(() => browser.close().catch(), 1000);
        return [page, account];
      }

      await page.goto('https://app.copilothub.ai/signup');
      // await Copilot.skipIntro(page);
      await page.waitForSelector(
        '#root > .app > .sider > .premium > .sign-up-btn',
      );
      await page.click('#root > .app > .sider > .premium > .sign-up-btn');

      await page.waitForSelector(
        '.semi-modal-body-wrapper > .semi-modal-body > .login-form-container > .semi-input-wrapper > .semi-input',
      );
      await page.click(
        '.semi-modal-body-wrapper > .semi-modal-body > .login-form-container > .semi-input-wrapper > .semi-input',
      );
      const emailBox = CreateEmail(TempEmailType.SmailPro);
      const emailAddress = await emailBox.getMailAddress();
      account.email = emailAddress;
      account.gpt4times = 0;
      this.accountPool.syncfile();
      // 将文本键入焦点元素
      await page.keyboard.type(emailAddress, { delay: 10 });

      await page.waitForSelector(
        '.login-form-container > .login-btn-container > .semi-button > .semi-button-content > .semi-button-content-left',
      );
      await page.click(
        '.login-form-container > .login-btn-container > .semi-button > .semi-button-content > .semi-button-content-left',
      );

      const msgs = (await emailBox.waitMails()) as TempMailMessage[];
      let validateURL: string | undefined;
      for (const msg of msgs) {
        validateURL = msg.content.match(
          /https:\/\/app.copilothub.co\/login[^"]*/i,
        )?.[0];
        if (validateURL) {
          break;
        }
      }
      if (!validateURL) {
        throw new Error('Error while obtaining verfication URL!');
      }
      await page.goto(validateURL);
      await sleep(2000);
      const password = randomStr(10);
      await page.waitForSelector('#password');
      await page.click('#password');
      await page.keyboard.type(password, { delay: 50 });

      await page.waitForSelector('#confirm_password');
      await page.click('#confirm_password');
      await page.keyboard.type(password, { delay: 50 });

      await page.waitForSelector(
        '.semi-modal-content > .semi-modal-body-wrapper > .semi-modal-body > .semi-button > .semi-button-content',
      );
      await page.click(
        '.semi-modal-content > .semi-modal-body-wrapper > .semi-modal-body > .semi-button > .semi-button-content',
      );
      await sleep(2000);
      account.login_time = moment().format(TimeFormat);
      account.gpt4times = 0;
      account.password = password;
      Copilot.getAuthKey(page).then((auth) => {
        account.auth_key = auth;
        this.accountPool.syncfile();
      });
      await Copilot.newChat(page);
      setTimeout(() => browser.close().catch(), 1000);
      console.log('register copilot successfully');
      return [page, account];
    } catch (e: any) {
      console.warn('something error happened,err:', e);
      return [] as any;
    }
  }

  public static async ifLogin(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(
        '#root > .app > .sider > .premium > .user-info',
        { timeout: 10 * 1000 },
      );
      await page.click('#root > .app > .sider > .premium > .user-info');
      console.log('still login in');
      return true;
    } catch (e: any) {
      return false;
    }
  }

  public static async clear(page: Page) {
    await page.waitForSelector(
      '.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content',
      { timeout: 10 * 60 * 1000 },
    );
    await page.click(
      '.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content',
    );
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page || !account.auth_key) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data: RealReq = {
      copilot_id: 5323,
      query: req.prompt,
    };
    try {
      const res = await this.client.post(
        '/v1/copilothub/chat/message/send/stream',
        data,
        {
          responseType: 'stream',
          headers: {
            Authorization: account.auth_key,
          },
        } as AxiosRequestConfig,
      );
      let old = '';
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
        if (
          req.model === ModelType.GPT4 ||
          req.model === ModelType.Claude100k
        ) {
          account.gpt4times += 1;
          this.accountPool.syncfile();
        }
        if (account.gpt4times >= MaxGptTimes) {
          account.gpt4times = 0;
          account.last_use_time = moment().format(TimeFormat);
          this.accountPool.syncfile();
          destroy();
        } else {
          done(account);
        }
      });
    } catch (e: any) {
      console.error('copilot ask stream failed, err', e);
      stream.write(Event.error, { error: e.message });
      stream.end();
      destroy(true);
    }
  }
}
