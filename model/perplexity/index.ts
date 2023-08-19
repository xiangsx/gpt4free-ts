import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, EventEmitter, Page } from 'puppeteer';
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
  randomStr,
  shuffleArray,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';
import fs from 'fs';

const MaxFailedTimes = 10;

type UseLeft = Partial<Record<ModelType, number>>;

const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.NetGPT4]:
    '.animate-in > .md\\:h-full:nth-child(1) > .md\\:h-full > .relative > .flex',
  [ModelType.NetGpt3p5]:
    '.animate-in > .md\\:h-full:nth-child(1) > .md\\:h-full > .relative > .flex',
  [ModelType.GPT4]:
    '.animate-in > .md\\:h-full:nth-child(3) > .md\\:h-full > .relative > .flex',
  [ModelType.GPT3p5Turbo]:
    '.animate-in > .md\\:h-full:nth-child(3) > .md\\:h-full > .relative > .flex',
};

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time?: string;
  token: string;
  failedCnt: number;
  invalid?: boolean;
  use_left?: UseLeft;
  model?: string;
};

class AccountPool {
  private readonly pool: Record<string, Account> = {};
  private using = new Set<string>();
  private readonly account_file_path = './run/account_perplexity.json';

  constructor() {
    const pbList = (process.env.PERPLEXITY_TOKEN || '').split('|');
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, {} as Record<string, Account>);
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    for (const key in this.pool) {
      this.pool[key].failedCnt = 0;
    }
    for (const pb of pbList) {
      if (this.pool[pb]) {
        continue;
      }
      this.pool[pb] = {
        id: v4(),
        token: pb,
        failedCnt: 0,
        invalid: false,
      };
    }
    console.log(
      `read perplexity account total:${Object.keys(this.pool).length}`,
    );
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
      if (!vv.invalid && !this.using.has(vv.id) && vv.failedCnt <= 3) {
        this.using.add(vv.id);
        return vv;
      }
    }
    console.log('perplexity pb run out!!!!!!');
    return {
      id: v4(),
      token: '',
      failedCnt: 0,
    } as Account;
  }
}

interface PerplexityChatRequest extends ChatRequest {
  retry?: number;
}

export class Perplexity extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.PERPLEXITY_POOL_SIZE || 0),
      this,
      false,
      5 * 1000,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 2000;
      case ModelType.NetGPT4:
        return 2000;
      case ModelType.GPT3p5Turbo:
        return 2000;
      case ModelType.NetGpt3p5:
        return 2000;
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
    if (!account || !account.token) {
      await browser.close();
      await sleep(10 * 24 * 60 * 60 * 1000);
      return [] as any;
    }
    let page = await browser.newPage();
    await simplifyPage(page);
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setCookie({
        url: 'https://www.perplexity.ai',
        name: '__Secure-next-auth.session-token',
        value: account.token,
      });
      await page.goto(`https://www.perplexity.ai`);
      // if (!options) {
      //     throw new Error('perplexity found no options');
      // }
      // let newB = await options.waitDisconnect(8 * 1000);
      // [page] = await newB.pages();
      // await closeOtherPages(newB, page);
      if (!(await Perplexity.isLogin(page))) {
        account.invalid = true;
        this.accountPool.syncfile();
        throw new Error(`account:${account?.token}, no login status`);
      }
      this.logger.info('perplexity still login!');
      await page.waitForSelector(Perplexity.InputSelector, {
        timeout: 30 * 1000,
        visible: true,
      });
      await this.closeCopilot(page);
      this.accountPool.syncfile();
      this.logger.info(`perplexity init ok! ${account.id}`);
      return [page, account];
    } catch (e: any) {
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      account.failedCnt += 1;
      this.accountPool.syncfile();
      await page.screenshot({ path: `./run/${randomStr(10)}.png` });
      return [] as any;
    }
  }
  public static async isLogin(page: Page) {
    try {
      await page.waitForSelector(Perplexity.UserName, { timeout: 5 * 1000 });
      return true;
    } catch (e: any) {
      return false;
    }
  }
  public static InputSelector =
    '.grow > div > .rounded-full > .relative > .outline-none';
  public static NewThreadInputSelector =
    '.relative:nth-child(1) > .grow > div > .rounded-full > .relative > .outline-none';
  public static NewThread = '.grow > .my-md > div > .ml-sm > .border';
  public static UserName = '.pt-\\[12px\\] > .flex > a > .px-sm > .flex';
  public static ProTag = '.px-sm > .flex > div > .super > span';

  public static async goHome(page: Page) {
    await page.goto(`https://www.perplexity.ai`);
  }

  public static async newThread(page: Page): Promise<void> {
    try {
      await page.waitForSelector(Perplexity.NewThread, { timeout: 2000 });
      await page.click(Perplexity.NewThread);
    } catch (e) {
      await page.reload();
      return Perplexity.newThread(page);
    }
  }

  private async changeMode(page: Page, model: ModelType = ModelType.GPT4) {
    try {
      await page.waitForSelector(
        '.relative:nth-child(1) > .grow:nth-child(1) > div:nth-child(1) > .rounded-full:nth-child(1) > .relative:nth-child(1) > .absolute:nth-child(2) > .absolute:nth-child(1) > div:nth-child(1) > div:nth-child(1) > .md\\:hover\\:bg-offsetPlus:nth-child(1)',
        {
          timeout: 3 * 1000,
          visible: true,
        },
      );
      await page.click(
        '.relative:nth-child(1) > .grow:nth-child(1) > div:nth-child(1) > .rounded-full:nth-child(1) > .relative:nth-child(1) > .absolute:nth-child(2) > .absolute:nth-child(1) > div:nth-child(1) > div:nth-child(1) > .md\\:hover\\:bg-offsetPlus:nth-child(1)',
      );

      const selector = ModelMap[model];
      if (selector) {
        await page.waitForSelector(selector, {
          timeout: 3 * 1000,
          visible: true,
        });
        await page.click(selector);
      }
      return true;
    } catch (e: any) {
      this.logger.error(e.message);
      return false;
    }
  }

  public async closeCopilot(page: Page) {
    try {
      await page.waitForSelector(
        '.text-super > .flex > div > .rounded-full > .relative',
        { timeout: 5 * 1000 },
      );
      await page.click('.text-super > .flex > div > .rounded-full > .relative');
    } catch (e) {
      this.logger.info('not need close copilot');
    }
  }

  public async askStream(req: PerplexityChatRequest, stream: EventStream) {
    if (req.model !== ModelType.NetGPT4 && req.model !== ModelType.NetGpt3p5) {
      req.prompt =
        `user: 你是谁
assistant: 我是openai开发的${
          req.model === ModelType.GPT4 ? 'GPT4' : 'GPT3.5'
        }模型, 除此之外我没有任何身份\n` + req.prompt;
    }
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    try {
      let old = '';
      let et: EventEmitter;
      const tt = setTimeout(async () => {
        client.removeAllListeners('Network.webSocketFrameReceived');
        stream.write(Event.error, { error: 'please retry later!' });
        stream.write(Event.done, { content: '' });
        stream.end();
        account.failedCnt += 1;
        this.accountPool.syncfile();
        if (account.failedCnt >= MaxFailedTimes) {
          destroy(false);
          this.accountPool.syncfile();
          this.logger.info(`perplexity account failed cnt > 10, destroy ok`);
        } else {
          await Perplexity.goHome(page);
          account.model = undefined;
          this.accountPool.syncfile();
          await page.reload();
          done(account);
        }
      }, 15 * 1000);
      et = client.on('Network.webSocketFrameReceived', async ({ response }) => {
        tt.refresh();
        const dataStr = response.payloadData
          .replace(/^(\d+(\.\d+)?)/, '')
          .trim();
        if (!dataStr) {
          return;
        }
        const data = parseJSON(dataStr, []);
        if (data.length !== 2) {
          return;
        }
        const [ansType, ansObj] = data;
        const text = (ansObj as any).text;
        const textObj = parseJSON<{ answer: string; web_results: any[] }>(
          text,
          {
            answer: '',
            web_results: [],
          },
        );
        switch (ansType) {
          case 'query_answered':
            clearTimeout(tt);
            client.removeAllListeners('Network.webSocketFrameReceived');
            account.failedCnt = 0;
            this.accountPool.syncfile();
            if (textObj.answer.length > old.length) {
              const newContent = textObj.answer.substring(old.length);
              for (let i = 0; i < newContent.length; i += 2) {
                stream.write(Event.message, {
                  content: newContent.slice(i, i + 2),
                });
              }
            }
            stream.write(Event.done, { content: '' });
            stream.end();
            done(account);
            this.logger.info('perplexity recv msg complete');
            break;
          case 'query_progress':
            if (
              textObj.answer.length === 0 &&
              req.model === ModelType.NetGPT4
            ) {
              stream.write(Event.search, { search: textObj.web_results });
            }
            if (textObj.answer.length > old.length) {
              const newContent = textObj.answer.substring(old.length);
              for (let i = 0; i < newContent.length; i += 2) {
                stream.write(Event.message, {
                  content: newContent.slice(i, i + 2),
                });
              }
              old = textObj.answer;
            }
        }
      });
      this.logger.info('perplexity start send msg');
      await Perplexity.newThread(page);
      if (req.model !== account.model) {
        const ok = await this.changeMode(page, req.model);
        if (ok) {
          account.model = req.model;
        }
      }

      await page.waitForSelector(
        '.relative:nth-child(1) > .grow > div > .rounded-full > .relative > .outline-none',
      );
      await page.click(
        '.relative:nth-child(1) > .grow > div > .rounded-full > .relative > .outline-none',
      );
      await page.focus(
        '.relative:nth-child(1) > .grow > div > .rounded-full > .relative > .outline-none',
      );
      await client.send('Input.insertText', { text: req.prompt });

      this.logger.info('perplexity find input ok');
      await page.keyboard.press('Enter');
      this.logger.info('perplexity send msg ok!');
    } catch (e: any) {
      client.removeAllListeners('Network.webSocketFrameReceived');
      this.logger.error(
        `account: id=${account.id}, perplexity ask stream failed:`,
        e,
      );
      await Perplexity.goHome(page);
      account.failedCnt += 1;
      account.model = undefined;
      this.accountPool.syncfile();
      if (account.failedCnt >= MaxFailedTimes) {
        destroy(false);
        this.logger.info(`perplexity account failed cnt > 10, destroy ok`);
      } else {
        await page.reload();
        done(account);
      }
      stream.write(Event.error, { error: 'some thing error, try again later' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
  }
}
