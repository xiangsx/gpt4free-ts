import { Chat, ChatOptions, ChatRequest, Message, ModelType } from '../base';
import { Browser, Page } from 'puppeteer';
import { BrowserPool, BrowserUser } from '../../utils/puppeteer';
import * as fs from 'fs';
import { Event, EventStream, parseJSON } from '../../utils';
import { v4 } from 'uuid';
import moment from 'moment';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';

type PageData = {
  gpt4times: number;
};

const MaxGptTimes = 20;

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

type Account = {
  id: string;
  email?: string;
  password?: string;
  login_time?: string;
  last_use_time?: string;
  gpt4times: number;
  cookies?: string;
};

interface ModelInfo {
  id: string;
  name: string;
}

const modelMap = {
  [ModelType.ClaudeInstant]: {
    id: 'claude-instant',
    name: 'CLAUDE-INSTANT',
  },
  [ModelType.Claude100k]: {
    id: 'claude-instant-100k',
    name: 'CLAUDE-INSTANT-100K',
  },
  [ModelType.Claude]: {
    id: 'claude+',
    name: 'CLAUDE+',
  },
  [ModelType.GPT4]: {
    id: 'gpt-4',
    name: 'GPT-4',
  },
  [ModelType.GPT3p5Turbo]: {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5-TURBO',
  },
} as Record<ModelType, ModelInfo>;

interface RealReq {
  model: ModelInfo;
  messages: Message[];
  key: string;
  prompt: string;
  temperature: number;
}

type HistoryData = {
  data: {
    query: string;
    result: string;
    created_at: string;
  }[];
};

class MagicAccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_Magic.json';
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
    const minInterval = 60 * 60 + 10 * 60; // 1hour + 10min
    const newAccount: Account = {
      id: v4(),
      last_use_time: now.format(TimeFormat),
      gpt4times: 0,
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

export class Magic extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: MagicAccountPool;
  private client: AxiosInstance;
  private ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67';

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new MagicAccountPool();
    let maxSize = +(process.env.MAGIC_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://magic.ninomae.top/api/',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://magic.ninomae.top',
          Referer: 'https://magic.ninomae.top',
          'User-Agent': this.ua,
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.ClaudeInstant:
        return 4000;
      case ModelType.Claude100k:
        return 50000;
      case ModelType.Claude:
        return 4000;
      case ModelType.GPT4:
        return 4000;
      case ModelType.GPT3p5Turbo:
        return 2500;
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
      this.ua = await browser.userAgent();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto('https://magic.ninomae.top');
      await page.waitForSelector(
        '.relative > .absolute > .stretch > .relative > .m-0',
      );
      const cookies = await page.cookies();
      account.cookies = cookies
        .map((item) => `${item.name}=${item.value}`)
        .join(';');
      if (!account.cookies) {
        throw new Error('cookies got failed!');
      }
      this.accountPool.syncfile();
      console.log('register Magic successfully');
      return [page, account];
    } catch (e: any) {
      console.warn('something error happened,err:', e);
      return [] as any;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page) {
      stream.write(Event.error, { error: 'please wait init.....about 1 min' });
      stream.end();
      return;
    }
    const data: RealReq = {
      key: '',
      prompt: '',
      messages: req.messages,
      model: modelMap[req.model],
      temperature: 1,
    };
    try {
      const res = await this.client.post('/chat', data, {
        headers: {
          Cookie: account.cookies,
          'User-Agent': this.ua,
        },
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.on('data', (chunk: any) => {
        stream.write(Event.message, { content: chunk.toString() });
      });
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        done(account);
        console.log('easy chat close');
        account.gpt4times += 1;
        this.accountPool.syncfile();
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
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
      destroy();
    }
  }
}
