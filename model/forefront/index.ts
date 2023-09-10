import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, Page, Protocol } from 'puppeteer';
import {
  BrowserPool,
  BrowserUser,
  PrepareOptions,
} from '../../utils/puppeteer';
import {
  CreateEmail,
  TempEmailType,
  TempMailMessage,
} from '../../utils/emailFactory';
import { CreateAxiosProxy, CreateTlsProxy } from '../../utils/proxyAgent';
import * as fs from 'fs';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';
import moment from 'moment';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import es from 'event-stream';

type PageData = {
  gpt4times: number;
};

const MaxGptTimes = 95;

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time?: string;
  gpt4times: number;
  headers?: Record<string, string>;
  chatID?: string;
  cookies: Protocol.Network.Cookie[];
};

interface RealReq {
  text: string;
  action: string;
  id: string;
  parentId: string;
  workspaceId: string;
  messagePersona: string;
  model: string;
  messages: string[];
  internetMode: string;
  hidden: boolean;
}

class AccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_forefront.json';

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
    const minInterval = 3 * 60 * 60 + 10 * 60; // 3hour + 10min
    for (const item of this.pool) {
      if (
        now.unix() - moment(item.last_use_time).unix() > minInterval ||
        item.gpt4times < MaxGptTimes
      ) {
        console.log(`find forefront old login account: `, item.id);
        item.last_use_time = now.format(TimeFormat);
        this.syncfile();
        return item;
      }
    }
    const newAccount: Account = {
      id: v4(),
      last_use_time: now.format(TimeFormat),
      gpt4times: 0,
      cookies: [],
    };
    this.pool.push(newAccount);
    this.syncfile();
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

interface ForefrontOptions extends ChatOptions {
  net: boolean;
}

export class Forefrontnew extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;
  private client: AxiosInstance;
  private net: boolean | undefined;

  constructor(options?: ForefrontOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.net = options?.net;
    let maxSize = +(process.env.POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(
      maxSize,
      this,
      false,
      10 * 1000,
      true,
    );
    this.client = CreateAxiosProxy({
      baseURL: 'https://streaming-worker.forefront.workers.dev',
      headers: {
        Accept: '*/*',
        Connection: 'Keep-alive',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 2500;
      case ModelType.Claude:
        return 2500;
      default:
        return 0;
    }
  }

  private async tryValidate(validateURL: string, triedTimes: number) {
    if (triedTimes === 10) {
      throw new Error('validate failed');
    }
    triedTimes += 1;
    try {
      const tsl = await CreateTlsProxy({ clientIdentifier: 'chrome_108' }).get(
        validateURL,
      );
    } catch (e: any) {
      console.log(e);
      await this.tryValidate(validateURL, triedTimes);
    }
  }

  private static async closeWelcomePop(page: Page) {
    try {
      console.log('try close welcome pop');
      await page.waitForSelector(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );
      await page.click(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );

      await page.waitForSelector(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );
      await page.click(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );

      await page.waitForSelector(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );
      await page.click(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );

      await page.waitForSelector(
        '.flex > .grid > .w-full > .cursor-pointer > .w-full',
      );
      await page.click('.flex > .grid > .w-full > .cursor-pointer > .w-full');

      await page.waitForSelector(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );
      await page.click(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );

      await page.waitForSelector(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );
      await page.click(
        '.relative > .flex > .w-full > .flex > .onboarding-button',
      );
      console.log('close welcome pop ok');
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

  private static async getChatID(page: Page): Promise<string> {
    const res = await page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        res.url().indexOf('listWorkspaces') !== -1,
    );
    const data: any = await res.json();
    return data[0].result.data.json[0].id;
  }

  async init(
    id: string,
    browser: Browser,
    options?: PrepareOptions,
  ): Promise<[Page | undefined, Account]> {
    const account = this.accountPool.getByID(id);
    try {
      if (!account) {
        throw new Error('account undefined, something error');
      }
      if (!options) {
        throw new Error('forefront failed get options');
      }

      let page = await browser.newPage();
      if (account.cookies.length > 0) {
        await page.setCookie(...account.cookies);
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('https://chat.forefront.ai/');
        Forefrontnew.getChatID(page).then((id) => (account.chatID = id));
        const ok = await Forefrontnew.ifLogin(page);
        if (!ok) {
          console.log(`logins status expired, delete ${account.id}`);
          return [undefined, account];
        }
        account.headers = await this.getAuth(page);
        return [page, account];
      }
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto('https://accounts.forefront.ai/sign-up');
      await page.waitForSelector('#emailAddress-field');
      await page.click('#emailAddress-field');

      await page.waitForSelector(
        '.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary',
      );
      await page.click(
        '.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary',
      );

      const emailBox = CreateEmail(
        (process.env.EMAIL_TYPE as TempEmailType) || TempEmailType.TempEmail44,
      );
      const emailAddress = await emailBox.getMailAddress();
      account.email = emailAddress;
      this.accountPool.syncfile();
      // 将文本键入焦点元素
      await page.keyboard.type(emailAddress, { delay: 10 });
      await page.keyboard.press('Enter');
      const newB = await options?.waitDisconnect(10 * 1000);
      [page] = await newB.pages();
      await page.setViewport({ width: 1520, height: 1080 });
      await page.reload();

      const msgs = (await emailBox.waitMails()) as TempMailMessage[];
      let validateURL: string | undefined;
      for (const msg of msgs) {
        validateURL = msg.content.match(
          /https:\/\/clerk\.forefront\.ai\/v1\/verify\?_clerk_js_version=(\d+\.\d+\.\d+)&amp;token=[^\s"]+/i,
        )?.[0];
        validateURL = validateURL?.replace('amp;', '');
        if (validateURL) {
          break;
        }
      }
      if (!validateURL) {
        throw new Error('Error while obtaining verfication URL!');
      }
      await this.tryValidate(validateURL, 0);
      Forefrontnew.getChatID(page).then((id) => (account.chatID = id));
      await Forefrontnew.closeWelcomePop(page);
      await page.waitForSelector(
        '.relative > .flex > .w-full > .text-th-primary-dark > div',
        { timeout: 120000 },
      );
      account.headers = await this.getAuth(page);
      account.cookies = (await page.cookies()).filter(
        (v) => v.name === '__session',
      );
      account.login_time = moment().format(TimeFormat);
      this.accountPool.syncfile();
      console.log('register successfully');
      return [page, account];
    } catch (e: any) {
      console.warn('something error happened,err:', e);
      return [] as any;
    }
  }

  public static async ifLogin(page: Page): Promise<boolean> {
    try {
      await page.waitForSelector(
        '.flex:nth-child(1) > .flex > .relative:nth-child(1) > .flex > .text-sm',
        { timeout: 5000 },
      );
      console.log('forefront still login in');
      return true;
    } catch (e: any) {
      return false;
    }
  }

  private async getAuth(page: Page): Promise<Record<string, string>> {
    await page.waitForSelector(
      '.relative > .flex > .w-full > .text-th-primary-dark > div',
      {
        timeout: 10000,
        visible: true,
      },
    );
    console.log('try get auth');
    await page.click(
      '.relative > .flex > .w-full > .text-th-primary-dark > div',
    );
    await page.focus(
      '.relative > .flex > .w-full > .text-th-primary-dark > div',
    );
    await page.keyboard.type('say 1');
    page.keyboard.press('Enter').then();
    const res = await page.waitForResponse((r) => {
      return (
        r.request().method() === 'POST' &&
        r.url() === 'https://streaming-worker.forefront.workers.dev/chat'
      );
    });
    const headers = res.request().headers();
    const auth = headers['authorization'];
    const sign = headers['x-signature'];
    if (!auth || !sign) {
      await sleep(2000);
      return this.getAuth(page);
    }
    console.log('get auth ok!');
    return headers;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page || !account.chatID || !account.headers) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data: RealReq = {
      text: req.prompt,
      action: 'new',
      id: '',
      parentId: account.chatID || '',
      workspaceId: account.chatID || '',
      messagePersona: 'default',
      model: req.model,
      messages: [],
      internetMode: this.net ? 'always' : 'never',
      hidden: true,
    };
    try {
      const res = await this.client.post('/chat', data, {
        responseType: 'stream',
        headers: {
          ...account.headers,
        },
      } as AxiosRequestConfig);
      let old = '';
      res.data.pipe(es.split('\n\n')).pipe(
        es.map(async (chunk: any, cb: any) => {
          const res = chunk.toString();
          if (!res) {
            return;
          }
          const [eventStr, dataStr] = res.split('\n');
          const event: string = eventStr.replace('event: ', '');
          if (event == 'end') {
            stream.write(Event.done, { content: '' });
            return;
          }
          const data = parseJSON(dataStr.replace('data: ', ''), {
            delta: '',
            error: { message: '' },
          });
          if (
            data?.error?.message &&
            data?.error?.message?.indexOf('rate limit') !== -1
          ) {
            stream.write(Event.error, { error: 'please retry!' });
            stream.end();
            return;
          }
          stream.write(Event.message, { content: data.delta || '' });
        }),
      );
      res.data.on('close', () => {
        stream.end();
        account.gpt4times += 1;
        this.accountPool.syncfile();
        account.last_use_time = moment().format(TimeFormat);
        if (account.gpt4times >= MaxGptTimes) {
          account.gpt4times = 0;
          this.accountPool.syncfile();
          destroy();
        } else {
          done(account);
        }
      });
    } catch (e: any) {
      console.error('forefront ask stream failed, err', e);
      stream.write(Event.error, { error: e.message });
      stream.end();
      destroy();
    }
  }
}
