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
  organization_uuid: string;
};

interface Attachment {
  file_name: string;
  file_size: number;
  file_type: string;
  extracted_content: string;
  totalPages: number | null;
}

interface RealReq {
  completion: {
    prompt: string;
    timezone: string;
    model: string;
    incremental: boolean;
  };
  organization_uuid: string;
  conversation_uuid: string;
  text: string;
  attachments: Attachment[];
}

class ClaudeAccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_claude.json';
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
      if (item.cookie.length > 0 && !this.using.has(item.id)) {
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
      organization_uuid: '',
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

interface ClaudeOptions extends ChatOptions {
  model: ModelType;
}

export class Claude extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: ClaudeAccountPool;
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new ClaudeAccountPool();
    let maxSize = +(process.env.CLAUDE_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this, true);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://claude.ai/api',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Claude2_100k:
        return 75000;
      default:
        return 0;
    }
  }

  public async ask(req: ChatRequest): Promise<ChatResponse> {
    const et = new EventStream();
    const res = await this.askStream(req, et);
    const result: ChatResponse = {
      content: '',
    };
    return new Promise((resolve) => {
      et.read(
        (event, data) => {
          if (!data) {
            return;
          }
          switch (event) {
            case 'message':
              result.content = (data as MessageData).content;
              break;
            case 'done':
              result.content = (data as DoneData).content;
              break;
            case 'error':
              result.error = (data as ErrorData).error;
              break;
            default:
              console.error(data);
              break;
          }
        },
        () => {
          resolve(result);
        },
      );
    });
  }

  deleteID(id: string): void {
    this.accountPool.delete(id);
  }

  newID(): string {
    const account = this.accountPool.get();
    return account.id;
  }

  async isLogin(page: Page) {
    try {
      await page.waitForSelector(
        '.flex > .flex > .overflow-y-auto > .ProseMirror > .is-empty',
        { timeout: 10 * 1000 },
      );
      return true;
    } catch (e: any) {
      return false;
    }
  }

  async getOrgID(page: Page): Promise<string> {
    const req = await page.waitForRequest(
      (req) => req.url().indexOf('https://claude.ai/api/organizations') !== -1,
    );
    return req.url().split('/')[5] || '';
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
      if (account.cookie.length > 0) {
        this.getOrgID(page).then((id) => {
          account.organization_uuid = id;
          this.accountPool.syncfile();
        });
        await page.goto('https://claude.ai');
        account.cookie = await page.cookies('https://claude.ai');
        if (await this.isLogin(page)) {
          return [page, account];
        }
      }
      // start
      await page.goto('https://claude.ai');
      await page.waitForSelector('#email');
      await page.click('#email');
      const emailBox = CreateEmail(
        (process.env.EMAIL_TYPE as TempEmailType) || TempEmailType.TempEmail44,
      );
      const emailAddress = await emailBox.getMailAddress();
      account.email = emailAddress;
      await page.keyboard.type(emailAddress, { delay: 10 });
      // 点击发送验证码
      const element = await page.evaluateHandle(() => {
        const elements = Array.from(
          document.querySelectorAll('* > main > * > .contents > *'),
        );
        return elements.find(
          (element) => element.textContent?.indexOf?.('Continue') !== -1,
        );
      });
      //@ts-ignore
      await element.click();

      // 点击输入验证码
      await page.waitForSelector('#code');
      await page.click('#code');
      const msgs = (await emailBox.waitMails()) as TempMailMessage[];
      let validateCode: string | undefined;
      for (const msg of msgs) {
        validateCode = msg.content.match(/>(\d{6})</i)?.[1];
        if (validateCode) {
          break;
        }
      }
      if (!validateCode) {
        throw new Error('Error while obtaining verfication code!');
      }
      await page.keyboard.type(validateCode, { delay: 10 });

      const continueLogin = await page.evaluateHandle(() => {
        const elements = Array.from(
          document.querySelectorAll('* > main > * > .contents > *'),
        );
        return elements.find(
          (element) =>
            element.textContent
              ?.toLowerCase()
              .indexOf('continue with login code') !== -1,
        );
      });
      //@ts-ignore
      await continueLogin.click();

      await page.waitForSelector('#fullname');
      await page.click('#fullname');
      await page.keyboard.type(randomStr(10), { delay: 10 });

      const adultAccept = await page.evaluateHandle(() => {
        const elements = Array.from(document.querySelectorAll('input'));
        return elements.find((element) => element.id === ':r1:');
      });
      //@ts-ignore
      await adultAccept.click();

      const agreeAccept = await page.evaluateHandle(() => {
        const elements = Array.from(document.querySelectorAll('input'));
        return elements.find((element) => element.id === ':r2:');
      });
      //@ts-ignore
      await agreeAccept.click();

      await page.waitForSelector('.h-full > main > .grid > button');
      await page.click('.h-full > main > .grid > button');

      await page.waitForSelector('main > .flex > .max-w-sm > .mt-4 > button');
      await page.click('main > .flex > .max-w-sm > .mt-4 > button');

      await page.waitForSelector(
        'main > .flex > .max-w-sm > .mt-4 > button:nth-child(2)',
      );
      await page.click(
        'main > .flex > .max-w-sm > .mt-4 > button:nth-child(2)',
      );

      await page.waitForSelector(
        'main > .flex > .max-w-sm > .mt-4 > button:nth-child(2)',
      );
      await page.click(
        'main > .flex > .max-w-sm > .mt-4 > button:nth-child(2)',
      );

      await page.waitForSelector(
        'main > .flex > .max-w-sm > .mt-4 > button:nth-child(2)',
      );
      await page.click(
        'main > .flex > .max-w-sm > .mt-4 > button:nth-child(2)',
      );
      // end

      account.cookie = await page.cookies('https://claude.ai');
      this.accountPool.syncfile();
      console.log('register claude successfully');
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

  public static async skipIntro(page: Page) {
    try {
      await page.waitForSelector(
        'div > div > button > .semi-typography > strong',
        { timeout: 5 * 1000 },
      );
      await page.click('div > div > button > .semi-typography > strong');
    } catch (e: any) {
      console.error(e.message);
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
    if (!account || !page || account.cookie.length === 0) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data: RealReq = {
      attachments: [],
      completion: {
        prompt: req.prompt,
        timezone: 'Asia/Shanghai',
        model: 'claude-2',
        incremental: false,
      },
      conversation_uuid: v4(),
      organization_uuid: account.organization_uuid,
      text: req.prompt,
    };
    try {
      const createRes = await this.client.post(
        `/organizations/${account.organization_uuid}/chat_conversations`,
        {
          name: '',
          uuid: data.conversation_uuid,
        },
        {
          headers: {
            Cookie: account.cookie
              .map((item) => `${item.name}=${item.value}`)
              .join('; '),
          },
        },
      );
      console.log(createRes);

      const res = await this.client.post('/append_message', data, {
        responseType: 'stream',
        headers: {
          Accept: 'text/event-stream',
          Cookie: account.cookie
            .map((item) => `${item.name}=${item.value}`)
            .join('; '),
        },
      } as AxiosRequestConfig);
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
        done(account);
      });
    } catch (e: any) {
      console.error('claude ask stream failed, err', e);
      stream.write(Event.error, { error: e.message });
      stream.end();
      destroy();
    }
  }
}
