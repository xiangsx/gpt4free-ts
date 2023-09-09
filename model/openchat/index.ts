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
  simplifyPage,
} from '../../utils/puppeteer';
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
import { AxiosInstance } from 'axios';
import { PassThrough } from 'stream';
import es from 'event-stream';

const MaxFailedTimes = 10;

type UseLeft = Partial<Record<ModelType, number>>;

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

interface MessageContent {
  content_type: string;
  parts: string[];
}

interface Author {
  role: string;
  name: null | string;
  metadata: Record<string, any>;
}

interface Metadata {
  message_type: string;
  model_slug: string;
  parent_id: string;
}

interface Message {
  id: string;
  author: Author;
  create_time: number;
  update_time: null | number;
  content: MessageContent;
  status: string;
  end_turn: null | any;
  weight: number;
  metadata: Metadata;
  recipient: string;
}

interface Conversation {
  message: Message;
  conversation_id: string;
  error: null | any;
}

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
  private readonly streamMap: Record<string, PassThrough>;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.OPENCHAT_POOL_SIZE || 0),
      this,
      false,
      10 * 1000,
      false,
    );
    this.client = CreateAxiosProxy({
      baseURL: 'https://chat.openai.com/backend-api/conversation',
    });
    this.streamMap = {};
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 21000;
      case ModelType.GPT3p5_16k:
        return 21000;
      default:
        return 0;
    }
  }

  async preHandle(
    req: ChatRequest,
    options?: { token?: boolean; countPrompt?: boolean },
  ): Promise<ChatRequest> {
    return super.preHandle(req, { token: true, countPrompt: true });
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

      await page.keyboard.press('Enter');

      await page.waitForSelector('#password');
      await page.click('#password');
      await page.keyboard.type(account.password);

      await page.keyboard.press('Enter');

      await sleep(3000);
      await this.newChat(page);
      this.getAuth(page).then((tk) => {
        account.accessToken = tk;
        account.last_use_time = moment().format(TimeFormat);
        this.accountPool.syncfile();
      });
      account.cookie = await this.getCookie(page);
      await page.exposeFunction('onChunk', (text: string) => {
        const stream = this.streamMap[account.id];
        if (stream) {
          stream.write(text);
        }
      });
      await page.exposeFunction('onChunkEnd', () => {
        const stream = this.streamMap[account.id];
        if (stream) {
          stream.end();
        }
      });
      this.logger.info('init ok');
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
    const newPage = await page.browser().newPage();
    const res = await newPage.goto('https://chat.openai.com/api/auth/session');
    const tk = (await res?.json())?.accessToken;
    newPage.close();
    return tk;
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
    try {
      if (moment().unix() - moment(account.last_use_time).unix() > 5 * 60) {
        this.getAuth(page).then((tk) => {
          account.accessToken = tk;
          account.last_use_time = moment().format(TimeFormat);
          this.accountPool.syncfile();
        });
      }
      const pt = new PassThrough();
      let old = '';
      pt.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
            return;
          }
          const data = parseJSON<Conversation>(dataStr, {} as Conversation);
          if (
            !data?.message?.author?.role ||
            data.message.author.role !== 'assistant'
          ) {
            return;
          }
          const parts = data?.message?.content?.parts;
          if (!parts || !parts.length) {
            return;
          }
          const content = parts?.join('');
          stream.write(Event.message, {
            content: content?.substring(old.length),
          });
          old = content;
        }),
      );
      pt.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        delete this.streamMap[account.id];
      });
      this.streamMap[account.id] = pt;
      await page.evaluate(
        (tk, prompt, arg1, arg2) => {
          const body = {
            action: 'next',
            messages: [
              {
                id: arg1,
                author: { role: 'user' },
                content: { content_type: 'text', parts: [prompt] },
                metadata: {},
              },
            ],
            parent_message_id: arg2,
            model: 'text-davinci-002-render-sha',
            timezone_offset_min: -480,
            suggestions: [
              'Compare design principles for mobile apps and desktop software in a concise table',
              'Come up with 5 concepts for a retro-style arcade game.',
              'Design a database schema for an online merch store.',
              "What can I do in Paris for 5 days, if I'm especially interested in fashion?",
            ],
            history_and_training_disabled: false,
            arkose_token: null,
          };
          return new Promise((resolve, reject) => {
            fetch('https://chat.openai.com/backend-api/conversation', {
              headers: {
                accept: 'text/event-stream',
                'accept-language': 'en-US',
                authorization: `Bearer ${tk}`,
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                pragma: 'no-cache',
                'sec-ch-ua':
                  '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
              },
              referrer:
                'https://chat.openai.com/?model=text-davinci-002-render-sha',
              referrerPolicy: 'same-origin',
              body: JSON.stringify(body),
              method: 'POST',
              mode: 'cors',
              credentials: 'include',
            })
              .then((response) => {
                if (!response.body) {
                  resolve(null);
                  return null;
                }
                const reader = response.body.getReader();
                function readNextChunk() {
                  reader
                    .read()
                    .then(({ done, value }) => {
                      const textChunk = new TextDecoder('utf-8').decode(value);
                      if (done) {
                        // @ts-ignore
                        window.onChunkEnd();
                        // @ts-ignore
                        resolve(textChunk);
                        return;
                      }
                      // @ts-ignore
                      window.onChunk(textChunk);
                      readNextChunk();
                    })
                    .catch((err) => {
                      reject(err);
                    });
                }
                readNextChunk();
              })
              .catch((err) => {
                reject(err);
              });
          });
        },
        account.accessToken,
        req.prompt,
        v4(),
        v4(),
      );
      done(account);
    } catch (e: any) {
      this.logger.error(e);
      done(account);
      delete this.streamMap[account.id];
      stream.write(Event.error, { error: 'some thing error, try again later' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
  }
}
