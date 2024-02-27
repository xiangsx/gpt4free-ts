import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  contentToString,
  ModelType,
} from '../base';
import { Browser, Page, Protocol } from 'puppeteer';
import { BrowserPool, BrowserUser } from '../../utils/puppeteer';
import * as fs from 'fs';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
  randomStr,
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
  useTimes: number;
};

interface RealReq {
  api_key: string;
  conversation_id: string;
  action: string;
  model: string;
  jailbreak: string;
  meta: Meta;
}

interface Meta {
  id: string;
  content: Content;
}

interface Content {
  conversation: ConversationItem[];
  internet_access: boolean;
  content_type: string;
  parts: Part[];
}

interface ConversationItem {
  role: string;
  content: string;
}

interface Part {
  content: string;
  role: string;
}

class RamAccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_ram.json';
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

export class Ram extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: RamAccountPool;
  private client: AxiosInstance;
  private useragent: string = randomUserAgent();

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new RamAccountPool();
    let maxSize = +(process.env.RAM_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this, false);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://chat.ramxn.dev/backend-api',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Origin: 'https://chat.ramxn.dev',
          Referer: 'https://chat.ramxn.dev',
          'Cache-Control': 'no-cache',
          'User-Agent': this.useragent,
        },
      } as CreateAxiosDefaults,
      false,
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

      await page.goto('https://chat.ramxn.dev/chat/');
      await sleep(10000);
      account.cookie = await page.cookies('https://chat.ramxn.dev');
      if (account.cookie.length === 0) {
        throw new Error('ram got cookie failed');
      }
      this.accountPool.syncfile();
      setTimeout(() => browser.close().catch(), 1000);
      console.log('register ram successfully');
      return [page, account];
    } catch (e: any) {
      console.warn('something error happened,err:', e);
      return [] as any;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page || !account.cookie || account.cookie.length === 0) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data: RealReq = {
      api_key: '',
      action: 'ask',
      conversation_id: v4(),
      jailbreak: 'default',
      meta: {
        id: randomStr(15),
        content: {
          content_type: 'ask',
          conversation: req.messages
            .slice(0, req.messages.length - 1)
            .map((v) => ({
              role: v.role,
              content: contentToString(v.content),
            })),
          internet_access: false,
          parts: [
            {
              content: contentToString(
                req.messages[req.messages.length - 1].content,
              ),
              role: 'user',
            },
          ],
        },
      },
      model: req.model,
    };
    try {
      account.useTimes += 1;
      this.accountPool.syncfile();
      const res = await this.client.post('/v2/conversation', data, {
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
        if (account.useTimes >= 500) {
          destroy();
        } else {
          done(account);
        }
      });
    } catch (e: any) {
      console.error('ram ask stream failed, err', e);
      stream.write(Event.error, { error: e.message });
      stream.end();
      destroy(true);
    }
  }
}
