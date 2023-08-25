import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, EventEmitter, Page, Protocol } from 'puppeteer';
import {
  BrowserPool,
  BrowserUser,
  PrepareOptions,
  simplifyPage,
} from '../../pool/puppeteer';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
  shuffleArray,
  sleep,
  TimeFormat,
} from '../../utils';
import { v4 } from 'uuid';
import fs from 'fs';
import moment from 'moment';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { AxiosInstance, AxiosRequestConfig } from 'axios';
import es from 'event-stream';

const MaxFailedTimes = 10;

type UseLeft = Partial<Record<ModelType, number>>;

interface Message {
  id: string;
  author: {
    role: string;
  };
  content: {
    content_type: string;
    parts: string[];
  };
  metadata: Record<string, any>;
}

interface RealReq {
  action: string;
  messages: Message[];
  parent_message_id: string;
  model: string;
  timezone_offset_min: number;
  suggestions: string[];
  history_and_training_disabled: boolean;
  arkose_token: string | null;
}

type Account = {
  id: string;
  login_time?: string;
  last_use_time?: string;
  email: string;
  password: string;
  failedCnt: number;
  invalid?: boolean;
  use_left?: UseLeft;
  model?: string;
  vip: boolean;
  accessToken?: string;
  cookie: Protocol.Network.Cookie[];
};

class AccountPool {
  private readonly pool: Record<string, Account> = {};
  private using = new Set<string>();
  private readonly account_file_path = './run/account_openai.json';

  constructor() {
    if (!process.env.OPENCHAT_EMAIL || !process.env.OPENCHAT_PASSWORD) {
      console.log('sincode found 0 account');
      return;
    }
    const sigList = process.env.OPENCHAT_EMAIL.split('|');
    const mainList = process.env.OPENCHAT_PASSWORD.split('|');
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, {} as Record<string, Account>);
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    for (const key in this.pool) {
      this.pool[key].failedCnt = 0;
      this.pool[key].model = undefined;
      if (!('vip' in this.pool)) {
        this.pool[key].vip = true;
      }
    }
    for (const idx in sigList) {
      const sig = sigList[idx];
      const main = mainList[idx];
      if (this.pool[sig]) {
        continue;
      }
      this.pool[sig] = {
        id: v4(),
        email: sig,
        password: main,
        failedCnt: 0,
        invalid: false,
        vip: true,
        cookie: [],
      };
    }
    console.log(`read sincode account total:${Object.keys(this.pool).length}`);
    this.syncfile();
  }

  public syncfile() {
    fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
  }

  public getByID(id: string) {
    for (const item in this.pool) {
      if (this.pool[item].id === id) {
        return this.pool[item];
      }
    }
  }

  public delete(id: string) {
    for (const v in this.pool) {
      const vv = this.pool[v];
    }
    this.using.delete(id);
    this.syncfile();
  }

  public get(): Account {
    for (const vv of shuffleArray(Object.values(this.pool))) {
      if (
        (!vv.invalid ||
          moment().subtract(10, 'm').isAfter(moment(vv.last_use_time))) &&
        !this.using.has(vv.id) &&
        vv.failedCnt <= MaxFailedTimes &&
        vv.vip
      ) {
        vv.invalid = false;
        this.syncfile();
        this.using.add(vv.id);
        return vv;
      }
    }
    console.log('sincode pb run out!!!!!!');
    return {
      id: v4(),
      email: '',
      failedCnt: 0,
    } as Account;
  }
}

interface PerplexityChatRequest extends ChatRequest {
  retry?: number;
}

export class OpenChat extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.OPENCHAT_POOL_SIZE || 0),
      this,
      false,
      10 * 1000,
      true,
    );
    this.client = CreateAxiosProxy({
      baseURL: 'https://chat.openai.com/backend-api/conversation',
    });
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 6000;
      case ModelType.GPT3p5Turbo:
        return 6000;
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
              result.content += (data as MessageData).content;
              break;
            case 'done':
              result.content += (data as DoneData).content;
              break;
            case 'error':
              result.error += (data as ErrorData).error;
              break;
            default:
              this.logger.error(data);
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

  async init(
    id: string,
    browser: Browser,
    options?: PrepareOptions,
  ): Promise<[Page | undefined, Account]> {
    const account = this.accountPool.getByID(id);
    if (!account || !account.email || !account.password) {
      await browser.close();
      await sleep(10 * 24 * 60 * 60 * 1000);
      return [] as any;
    }
    let page = await browser.newPage();
    try {
      await simplifyPage(page);
      page.setDefaultNavigationTimeout(60 * 1000);
      await page.setViewport({ width: 1920, height: 1080 });
      await sleep(1000);
      await page.deleteCookie(
        ...(await page.cookies('https://chat.openai.com/chat')),
      );
      await page.goto(`https://chat.openai.com/chat`);
      await page.waitForSelector(
        '.flex > .relative > .mt-5 > .grid > .relative:nth-child(1)',
      );
      await page.click(
        '.flex > .relative > .mt-5 > .grid > .relative:nth-child(1)',
      );
      await page.waitForSelector('#username');
      await page.click('#username', { count: 3 });
      await page.keyboard.type(account.email);

      await page.waitForSelector(
        '.caa93cde1 > .cc617ed97 > .c078920ea > .c22fea258 > .cf1ef5a0b',
      );
      await page.click(
        '.caa93cde1 > .cc617ed97 > .c078920ea > .c22fea258 > .cf1ef5a0b',
      );

      await page.waitForSelector('#password');
      await page.click('#password');
      await page.keyboard.type(account.password);

      await page.waitForSelector(
        '.c01e01e17 > .cc04c7973 > .c078920ea > .c22fea258 > .cf1ef5a0b',
      );
      await page.click(
        '.c01e01e17 > .cc04c7973 > .c078920ea > .c22fea258 > .cf1ef5a0b',
      );

      await this.closeWelcome(page);
      this.getAuth(page).then((tk) => {
        account.accessToken = tk;
        this.accountPool.syncfile();
      });
      await this.newChat(page);
      account.cookie = await this.getCookie(page);
      this.logger.info('register ok');
      return [page, account];
    } catch (e: any) {
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      account.failedCnt += 1;
      this.accountPool.syncfile();
      return [] as any;
    }
  }

  async getCookie(page: Page) {
    return await page.cookies('https://chat.openai.com');
  }

  async getAuth(page: Page): Promise<string> {
    const res = await page.waitForResponse(
      (req) => req.url() === 'https://chat.openai.com/api/auth/session',
    );
    return (await res.json()).accessToken;
  }

  async closeWelcome(page: Page) {
    try {
      await page.waitForSelector('.p-4 > .prose > .flex > .btn > .flex', {
        timeout: 10000,
      });
      await page.click('.p-4 > .prose > .flex > .btn > .flex');

      await page.waitForSelector(
        '.p-4 > .prose > .flex > .btn:nth-child(2) > .flex',
      );
      await page.click('.p-4 > .prose > .flex > .btn:nth-child(2) > .flex');

      await page.waitForSelector(
        '#radix-\\:ri\\: > .p-4 > .prose > .flex > .btn:nth-child(2)',
      );
      await page.click(
        '#radix-\\:ri\\: > .p-4 > .prose > .flex > .btn:nth-child(2)',
      );
      this.logger.info('close welcome ok!');
    } catch (e) {
      this.logger.info('not need close welcome');
    }
  }

  async newChat(page: Page) {
    await page.waitForSelector(
      '.flex > .scrollbar-trigger > .flex > .mb-1 > .flex',
    );
    await page.click('.flex > .scrollbar-trigger > .flex > .mb-1 > .flex');
  }

  SLInput = `#prompt-textarea`;

  public async askStream(req: PerplexityChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    const client = await page.target().createCDPSession();
    const tt = setTimeout(async () => {
      client.removeAllListeners('Network.eventSourceMessageReceived');
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      this.logger.error('wait msg timeout, destroyed!');
      done(account);
    }, 10 * 1000);
    try {
      await client.send('Network.enable');
      await client.send('Network.enable');
      await client.send('Network.setRequestInterception', {
        patterns: [{ urlPattern: '*' }],
      });

      client.on('Network.requestIntercepted', async ({ interceptionId }) => {
        await client.send('Network.continueInterceptedRequest', {
          interceptionId,
        });
      });

      client.on('Network.responseReceived', async (event) => {
        if (
          event.response.url ===
          'https://chat.openai.com/backend-api/conversation'
        ) {
          const { stream } = await client.send(
            'Network.takeResponseBodyForInterceptionAsStream',
            { interceptionId: event.requestId },
          );

          client.on('IO.read', ({ data }) => {
            console.log(data);
          });

          await client.send('IO.read', { handle: stream });
        }
      });

      this.logger.info('sincode start send msg');

      await page.waitForSelector(this.SLInput);
      await page.click(this.SLInput);
      await client.send('Input.insertText', { text: req.prompt });

      this.logger.info('find input ok');
      await page.keyboard.press('Enter');
      this.logger.info('send msg ok!');
    } catch (e: any) {
      client.removeAllListeners('Network.eventSourceMessageReceived');
      clearTimeout(tt);
      this.logger.error(`account: id=${account.id}, ask stream failed:`, e);
      account.failedCnt += 1;
      account.model = undefined;
      this.accountPool.syncfile();
      done(account);
      stream.write(Event.error, { error: 'some thing error, try again later' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
  }
}
