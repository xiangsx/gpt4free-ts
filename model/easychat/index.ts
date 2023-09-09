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
} from '../../utils';
import { v4 } from 'uuid';
import moment from 'moment';
import TurndownService from 'turndown';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import es from 'event-stream';

const turndownService = new TurndownService({ codeBlockStyle: 'fenced' });

type PageData = {
  gpt4times: number;
};

const MaxGptTimes = 10;

const TimeFormat = 'YYYY-MM-DD HH:mm:ss';

interface Message {
  role: string;
  content: string;
}

interface RealReq {
  messages: Message[];
  stream: boolean;
  model: string;
  temperature: number;
  presence_penalty: number;
  frequency_penalty: number;
}

type Account = {
  id: string;
  email?: string;
  password?: string;
  login_time?: string;
  last_use_time?: string;
  gpt4times: number;
  cookies?: string;
};

type HistoryData = {
  data: {
    query: string;
    result: string;
    created_at: string;
  }[];
};

class EasyChatAccountPool {
  private pool: Account[] = [];
  private readonly account_file_path = './run/account_EasyChat.json';
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
    for (const item of this.pool) {
      if (now.unix() - moment(item.last_use_time).unix() > minInterval) {
        console.log(`find old login account:`, JSON.stringify(item));
        item.last_use_time = now.format(TimeFormat);
        this.syncfile();
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

interface EasyChatOptions extends ChatOptions {
  model: ModelType;
}

export class EasyChat extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: EasyChatAccountPool;
  private readonly model: ModelType;
  private client: AxiosInstance;

  constructor(options?: EasyChatOptions) {
    super(options);
    this.model = options?.model || ModelType.GPT4;
    this.accountPool = new EasyChatAccountPool();
    let maxSize = +(process.env.EASYCHAT_POOL_SIZE || 0);
    this.pagePool = new BrowserPool<Account>(maxSize, this);
    this.client = CreateAxiosProxy({
      baseURL: 'https://free.easychat.work/api/openai/v1/',
      headers: {
        'Content-Type': 'application/json',
        accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case this.model:
        return 5000;
      default:
        return 0;
    }
  }

  private static async closeWelcomePop(page: Page) {
    try {
      await page.waitForSelector(
        '.fixed > #radix-\\:r0\\: > .flex > .button_icon-button__BC_Ca > .button_icon-button-text__k3vob',
      );
      await page.click(
        '.fixed > #radix-\\:r0\\: > .flex > .button_icon-button__BC_Ca > .button_icon-button-text__k3vob',
      );
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
      if (account.login_time) {
        await browser.close();
        return [page, account];
      }
      await page.goto('https://free.easychat.work/#/register');
      await page.waitForSelector('#email');
      await page.click('#email');

      const emailBox = CreateEmail(
        (process.env.EMAIL_TYPE as TempEmailType) || TempEmailType.TempEmail44,
      );
      const emailAddress = await emailBox.getMailAddress();
      account.email = emailAddress;
      account.gpt4times = 0;
      this.accountPool.syncfile();
      // 将文本键入焦点元素
      await page.keyboard.type(emailAddress, { delay: 10 });

      await page.waitForSelector('#password');
      await page.click('#password');

      account.password = randomStr(12);
      await page.keyboard.type(account.password, { delay: 10 });

      await page.waitForSelector('#submit');
      await page.click('#submit');

      const msgs = (await emailBox.waitMails()) as TempMailMessage[];
      let validateCode: string | undefined;
      for (const msg of msgs) {
        validateCode = msg.content.match(/\b\d{6}\b/i)?.[0];
        if (validateCode) {
          break;
        }
      }
      if (!validateCode) {
        throw new Error('Error while obtaining verfication URL!');
      }
      await page.waitForSelector('#showOtp');
      await page.click('#showOtp');

      await page.keyboard.type(validateCode, { delay: 10 });

      await page.waitForSelector('#submit');
      await page.click('#submit');

      account.login_time = moment().format(TimeFormat);
      account.gpt4times = 0;
      this.accountPool.syncfile();
      await EasyChat.closeWelcomePop(page);
      const cookies = await page.cookies();
      account.cookies = cookies
        .map((item) => `${item.name}=${item.value}`)
        .join(';');
      if (!account.cookies) {
        throw new Error('cookies got failed!');
      }
      this.accountPool.syncfile();
      console.log('register EasyChat successfully');
      return [page, account];
    } catch (e: any) {
      console.warn('something error happened,err:', e);
      return [] as any;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    req.prompt = req.prompt.replace(/\n/g, ' ');
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.end();
      return;
    }
    let model = 'gpt-4';
    switch (model) {
      case ModelType.GPT3p5Turbo:
        model = 'gpt-3.5-turbo';
        break;
    }
    const data: RealReq = {
      frequency_penalty: 0,
      messages: [{ role: 'user', content: req.prompt }],
      model,
      presence_penalty: 0,
      stream: true,
      temperature: 1,
    };
    try {
      const res = await this.client.post('/chat/completions', data, {
        responseType: 'stream',
        headers: {
          Cookie: account.cookies,
        },
      } as AxiosRequestConfig);
      let old = '';
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          try {
            const dataStr = chunk.replace('data: ', '');
            if (!dataStr) {
              return;
            }
            if (dataStr === '[DONE]') {
              stream.write(Event.done, { content: old });
              stream.end();
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
            if (
              finish_reason === 'stop' ||
              content.indexOf(`https://discord.gg/cattogpt`) !== -1
            ) {
              return;
            }
            old = content;
            stream.write(Event.message, { content });
          } catch (e: any) {
            console.error(e.message);
          }
        }),
      );
      res.data.on('close', () => {
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
