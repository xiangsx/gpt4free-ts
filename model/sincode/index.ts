import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, EventEmitter, Page } from 'puppeteer';
import { BrowserPool, BrowserUser, PrepareOptions } from '../../pool/puppeteer';
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
  [ModelType.GPT3p5Turbo]: '#gpt35',
  [ModelType.GPT4]: '#gpt4',
};

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
};

class AccountPool {
  private readonly pool: Record<string, Account> = {};
  private using = new Set<string>();
  private readonly account_file_path = './run/account_sincode.json';

  constructor() {
    const sigList = (process.env.SINCODE_EMAIL || '').split('|');
    const mainList = (process.env.SINCODE_PASSWORD || '').split('|');
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
      if (!vv.invalid && !this.using.has(vv.id) && vv.failedCnt <= 3) {
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

export class SinCode extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.SINCODE_POOL_SIZE || 0),
      this,
      false,
      20 * 1000,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 4000;
      case ModelType.GPT3p5Turbo:
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
    if (!account || !account.email || !account.password) {
      await browser.close();
      await sleep(10 * 24 * 60 * 60 * 1000);
      return [] as any;
    }
    let page = await browser.newPage();
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.deleteCookie(
        { name: 'sincode_live_u2main.sig', domain: '.www.sincode.ai' },
        { name: 'sincode_live_u2main', domain: '.www.sincode.ai' },
        { name: 'cc_cookie', domain: '.www.sincode.ai' },
      );
      await sleep(1000);
      await page.goto(`https://www.sincode.ai/app`);
      await page.waitForSelector(
        '.cnaBeaI > .bubble-element > div > font > strong',
      );
      const loginText: string = await page.evaluate(
        () =>
          // @ts-ignore
          document.querySelector(
            '.cnaBeaI > .bubble-element > div > font > strong',
          ).textContent || '',
      );
      if (loginText.indexOf('Login') !== -1) {
        await page.click('.cnaBeaI > .bubble-element > div > font > strong');
      }
      await page.waitForSelector(
        '.bubble-element:nth-child(1) > .bubble-r-container:nth-child(1) > .bubble-element:nth-child(1) > .bubble-element:nth-child(2) > .bubble-element:nth-child(1) > .bubble-element:nth-child(2)',
      );
      await page.click(
        '.bubble-element:nth-child(1) > .bubble-r-container:nth-child(1) > .bubble-element:nth-child(1) > .bubble-element:nth-child(2) > .bubble-element:nth-child(1) > .bubble-element:nth-child(2)',
      );
      await page.type(
        '.bubble-element:nth-child(1) > .bubble-r-container:nth-child(1) > .bubble-element:nth-child(1) > .bubble-element:nth-child(2) > .bubble-element:nth-child(1) > .bubble-element:nth-child(2)',
        account.email,
        { delay: 100 },
      );

      await page.waitForSelector('#pw_login');
      await page.click('#pw_login');
      await page.type('#pw_login', account.password);
      await page.keyboard.press('Enter');
      await sleep(1000);
      await page.goto(`https://www.sincode.ai/app/marve`);
      if (!(await this.isLogin(page))) {
        account.failedCnt += 1;
        if (account.failedCnt > 3) {
          account.invalid = true;
        }
        this.accountPool.syncfile();
        throw new Error(`account:${account?.email}, no login status`);
      }
      await this.newChat(page);
      this.accountPool.syncfile();
      this.logger.info('sincode login ok!');
      return [page, account];
    } catch (e: any) {
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      account.failedCnt += 1;
      this.accountPool.syncfile();
      await page.screenshot({ path: `./run/${randomStr(10)}.png` });
      return [] as any;
    }
  }

  async newChat(page: Page) {
    await page.waitForSelector(this.SLNewChat);
    await page.click(this.SLNewChat);
  }

  public async isLogin(page: Page) {
    try {
      // new chat
      await page.waitForSelector(this.SLNewChat, { timeout: 10 * 1000 });
      return true;
    } catch (e: any) {
      return false;
    }
  }

  SLNewChat =
    '#scrollbar > #scrollbar1 > .bubble-element > .clickable-element > .bubble-element:nth-child(2)';
  SLInput = 'textarea';
  public static NewThreadInputSelector =
    '.relative:nth-child(1) > .grow > div > .rounded-full > .relative > .outline-none';
  public static NewThread = '.grow > .my-md > div > .border > .text-clip';
  public static UserName = '.px-sm > .flex > div > .flex > .line-clamp-1';
  public static ProTag = '.px-sm > .flex > div > .super > span';
  public static async goHome(page: Page) {
    await page.goto(`https://www.sincode.ai`);
  }

  public static async newThread(page: Page): Promise<void> {
    try {
      await page.waitForSelector(SinCode.NewThread, { timeout: 2000 });
      await page.click(SinCode.NewThread);
    } catch (e) {
      await page.reload();
      return SinCode.newThread(page);
    }
  }

  private async changeMode(page: Page, model: ModelType = ModelType.GPT4) {
    try {
      await page.waitForSelector('#features');
      await page.click('#features');

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

  public static async closeCopilot(page: Page) {
    try {
      await page.waitForSelector(
        '.text-super > .flex > div > .rounded-full > .relative',
        { timeout: 5 * 1000 },
      );
      await page.click('.text-super > .flex > div > .rounded-full > .relative');
    } catch (e) {}
  }

  public async askStream(req: PerplexityChatRequest, stream: EventStream) {
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
          this.logger.info(`sincode account failed cnt > 10, destroy ok`);
        } else {
          await SinCode.goHome(page);
          account.model = undefined;
          this.accountPool.syncfile();
          await page.reload();
          done(account);
        }
      }, 15 * 1000);
      let currMsgID = '';
      et = client.on(
        'Network.webSocketFrameReceived',
        async ({ response, requestId }, ...rest2) => {
          tt.refresh();
          const dataStr = response.payloadData;
          if (!dataStr) {
            return;
          }
          if (dataStr === 'pong') {
            return;
          }
          if (dataStr.indexOf('xxUNKNOWNERRORxx') !== -1) {
            client.removeAllListeners('Network.webSocketFrameReceived');
            clearTimeout(tt);
            this.logger.error(`sincode return error, ${dataStr}`);
            stream.write(Event.error, { error: 'please retry later!' });
            stream.end();
          }
          if (dataStr.indexOf('RESPONSE_START') !== -1) {
            currMsgID = requestId;
            return;
          }
          if (dataStr.indexOf('DONE') !== -1) {
            client.removeAllListeners('Network.webSocketFrameReceived');
            clearTimeout(tt);
            stream.write(Event.done, { content: '' });
            stream.end();
            account.failedCnt = 0;
            await this.newChat(page);
            this.accountPool.syncfile();
          }
          if (requestId !== currMsgID) {
            return;
          }
          stream.write(Event.message, { content: dataStr });
        },
      );
      this.logger.info('sincode start send msg');
      if (req.model !== account.model) {
        const ok = await this.changeMode(page, req.model);
        if (ok) {
          account.model = req.model;
        }
      }

      await page.waitForSelector(this.SLInput);
      await page.click(this.SLInput);
      await client.send('Input.insertText', { text: req.prompt });

      this.logger.info('sincode find input ok');
      await page.keyboard.press('Enter');
      this.logger.info('sincode send msg ok!');
    } catch (e: any) {
      client.removeAllListeners('Network.webSocketFrameReceived');
      this.logger.error(
        `account: id=${account.id}, sincode ask stream failed:`,
        e,
      );
      await SinCode.goHome(page);
      account.failedCnt += 1;
      account.model = undefined;
      this.accountPool.syncfile();
      if (account.failedCnt >= MaxFailedTimes) {
        destroy(false);
        this.logger.info(`sincode account failed cnt > 10, destroy ok`);
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
