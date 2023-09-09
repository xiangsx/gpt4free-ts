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
} from '../../utils/puppeteer';
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
  TimeFormat,
} from '../../utils';
import { v4 } from 'uuid';
import fs from 'fs';
import moment from 'moment';

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
  vip: boolean;
};

class AccountPool {
  private readonly pool: Record<string, Account> = {};
  private using = new Set<string>();
  private readonly account_file_path = './run/account_sincode.json';

  constructor() {
    if (!process.env.SINCODE_EMAIL || !process.env.SINCODE_PASSWORD) {
      console.log('sincode found 0 account');
      return;
    }
    const sigList = process.env.SINCODE_EMAIL.split('|');
    const mainList = process.env.SINCODE_PASSWORD.split('|');
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

  public release(id: string) {
    this.using.delete(id);
  }

  public get(): Account {
    for (const vv of shuffleArray(Object.values(this.pool))) {
      if (
        (!vv.invalid ||
          moment().subtract(5, 'm').isAfter(moment(vv.last_use_time))) &&
        !this.using.has(vv.id) &&
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

export class Jasper extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.JASPER_POOL_SIZE || 0),
      this,
      false,
      10 * 1000,
      false,
    );
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

  deleteID(id: string): void {
    this.accountPool.delete(id);
  }

  release(id: string): void {
    this.accountPool.release(id);
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
    if (!account) {
      await browser.close();
      await sleep(10 * 60 * 60 * 1000);
      return [] as any;
    }
    let page = await browser.newPage();
    try {
      await simplifyPage(page);
      await page.setViewport({ width: 1920, height: 1080 });
      await sleep(1000);
      await page.goto(`https://app.jasper.ai/chat`);
      await sleep(10 * 60 * 1000);
      return [page, account];
    } catch (e: any) {
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      account.failedCnt += 1;
      this.accountPool.syncfile();
      await sleep(Math.floor(Math.random() * 10 * 60 * 1000));
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
      await page.waitForSelector(this.SLNewChat, { timeout: 15 * 1000 });
      return true;
    } catch (e: any) {
      return false;
    }
  }

  SLNewChat =
    '#scrollbar > #scrollbar1 > .bubble-element > .clickable-element > .bubble-element:nth-child(2)';
  SLInput = 'textarea';
  public static async goHome(page: Page) {
    await page.goto(`https://www.sincode.ai`);
  }

  public async isVIP(page: Page) {
    await page.waitForSelector(this.SLInput);
    await page.click(this.SLInput);
    await page.keyboard.type('say 1');
    await page.keyboard.press('Enter');
    try {
      await page.waitForSelector(
        'body > div.bubble-element.CustomElement.cnaMaEa0.bubble-r-container.relative',
        { timeout: 5000 },
      );
      return false;
    } catch (e) {
      return true;
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
      this.logger.error('wait msg timeout, destroyed!');
      client.removeAllListeners('Network.webSocketFrameReceived');
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      destroy(undefined, undefined, 10 * 60 * 1000);
    }, 10 * 1000);
    try {
      let old = '';
      let et: EventEmitter;
      let currMsgID = '';
      await client.send('Network.enable');
      et = client.on(
        'Network.webSocketFrameReceived',
        async ({ response, requestId }, ...rest2) => {
          const dataStr = response?.payloadData || '';
          if (!dataStr) {
            return;
          }
          try {
            if (dataStr === 'pong') {
              return;
            }
            tt.refresh();
            if (dataStr.indexOf('xxUNKNOWNERRORxx') !== -1) {
              client.removeAllListeners('Network.webSocketFrameReceived');
              clearTimeout(tt);
              this.logger.error(`sincode return error, ${dataStr}`);
              await this.newChat(page);
              stream.write(Event.error, { error: 'please retry later!' });
              stream.end();
              account.failedCnt += 1;
              account.last_use_time = moment().format(TimeFormat);
              account.invalid = true;
              this.accountPool.syncfile();
              destroy(undefined, undefined, 10 * 60 * 1000);
              return;
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
              this.accountPool.syncfile();
              await this.newChat(page);
              this.logger.info(`recv msg ok`);
              done(account);
            }
            if (requestId !== currMsgID) {
              return;
            }
            stream.write(Event.message, { content: dataStr });
          } catch (e) {
            this.logger.error(`handle msg failed, dataStr:${dataStr}, err:`, e);
          }
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
      clearTimeout(tt);
      this.logger.error(
        `account: id=${account.id}, sincode ask stream failed:`,
        e,
      );
      account.failedCnt += 1;
      account.model = undefined;
      this.accountPool.syncfile();
      destroy(undefined, undefined, 10 * 60 * 1000);
      stream.write(Event.error, { error: 'some thing error, try again later' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
  }
}
