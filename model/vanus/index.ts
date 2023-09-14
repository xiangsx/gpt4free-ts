import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Browser, Page } from 'puppeteer';
import { BrowserPool, BrowserUser, simplifyPage } from '../../utils/puppeteer';
import {
  Event,
  EventStream,
  parseJSON,
  randomStr,
  shuffleArray,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';

import fs from 'fs';
import moment from 'moment';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import es from 'event-stream';
import { throws } from 'assert';

const ModelMap: Partial<Record<ModelType, any>> = {
  [ModelType.GPT4]: '01c8de4fbfc548df903712b0922a4e01',
  [ModelType.GPT3p5Turbo]: '8077335db7cd47e29f7de486612cc7fd',
};

const MaxFailedTimes = 10;

type Account = {
  id: string;
  email?: string;
  password?: string;
  login_time?: string;
  appid?: string;
  last_use_time: number;
  failedCnt: number;
  token: string;
  left: number;
};

interface ReplyMessage {
  id: number;
  uid: string;
  userId: number;
  userUid: string;
  type: string;
  botId: number;
  replyUid: string;
  status: string;
  text: string | null;
  handled: boolean;
  translation: string | null;
  voiceUrl: string | null;
  createdDate: string;
  updatedDate: string;
  botUid: string;
}

interface TextStreamData {
  replyMessage: ReplyMessage;
  index: number;
  text: string;
  isFinal: boolean;
}

interface TextStream {
  reqId: string;
  traceId: string;
  data: TextStreamData;
}

class AccountPool {
  private pool: Account[] = [];
  private using = new Set<string>();
  private readonly account_file_path = './run/account_vanus.json';

  constructor() {
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, [] as Account[]);
      if (!Array.isArray(this.pool)) {
        this.pool = [];
        this.syncfile();
      }
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    for (const v of this.pool) {
      v.failedCnt = 0;
    }
    console.log(
      `read vanus old account total:${Object.keys(this.pool).length}`,
    );
    this.syncfile();
  }

  public syncfile() {
    fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
  }

  public release(id: string) {
    this.using.delete(id);
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
    for (const vv of shuffleArray(this.pool)) {
      if (this.using.has(vv.id)) {
        continue;
      }
      if ((vv.left || 0) < 20) {
        continue;
      }
      this.using.add(vv.id);
      vv.failedCnt = 0;
      return vv;
    }
    console.log('vanus account run out, register new now!');
    const newV: Account = {
      id: v4(),
      failedCnt: 0,
      left: 0,
      token: '',
      last_use_time: moment().unix(),
    };
    this.pool.push(newV);
    return newV;
  }
}

export class Vanus extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: AccountPool;
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new AccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.VANUS_POOL_SIZE || 0),
      this,
      false,
      5000,
      false,
    );
    this.client = CreateAxiosProxy(
      {
        headers: {
          'x-vanusai-host': 'ai.vanus.ai',
        },
      },
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 7800;
      case ModelType.GPT3p5Turbo:
        return 3900;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: true,
      countPrompt: true,
      forceRemove: true,
    });
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
  ): Promise<[Page | undefined, Account]> {
    const account = this.accountPool.getByID(id);
    if (!account) {
      await sleep(10 * 24 * 60 * 60 * 1000);
      return [] as any;
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await simplifyPage(page);
    try {
      if (!account.appid) {
        await page.goto('https://ai.vanus.ai/');
        await sleep(5000);

        await page.waitForSelector('#a-signup');
        await page.click('#a-signup');

        await page.waitForSelector('#signup-email');
        await page.click('#signup-email');

        account.email = `${randomStr(20)}@googlemail.com`.toLowerCase();
        account.password = `Ab1${randomStr(20)}`;
        await page.keyboard.type(account.email, { delay: 10 });

        await page.waitForSelector('#signup-password');
        await page.click('#signup-password');
        await page.keyboard.type(account.password, { delay: 10 });

        await page.waitForSelector(
          '.widget-container > #sign-up > form > #checkbox > input',
        );
        await page.click(
          '.widget-container > #sign-up > form > #checkbox > input',
        );
        await sleep(1000);
        await page.keyboard.press('Enter');

        await page.waitForSelector('#btn-signup');
        await page.click('#btn-signup');

        await page.waitForSelector('#given_name');
        await page.click('#given_name');
        await page.keyboard.type(randomStr(5));

        await page.waitForSelector('#family_name');
        await page.click('#family_name');

        await page.waitForSelector('#company_name');
        await page.click('#company_name');
        await page.keyboard.type(randomStr(5));

        await page.waitForSelector('#company_email');
        await page.click('#company_email');
        await page.waitForSelector(
          '.ant-row > .ant-col > .ant-form-item-control-input > .ant-form-item-control-input-content > .ant-btn',
        );
        await page.click(
          '.ant-row > .ant-col > .ant-form-item-control-input > .ant-form-item-control-input-content > .ant-btn',
        );
        for (let i = 0; i < 3; i++) {
          const [appid, left] = await this.getInfo(page);
          if (!appid || !left) {
            continue;
          }
          account.appid = appid;
          account.left = left.total - left.used;
          this.accountPool.syncfile();
          break;
        }
      }
      this.logger.info(`init ok! ${account.id}`);
      await browser.close();
      return [page, account];
    } catch (e: any) {
      await page.screenshot({ path: `./run/error_${account.id}.png` });
      await browser.close();
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      return [] as any;
    }
  }

  async getInfo(page: Page) {
    try {
      this.createGPT4(page).then(() => this.logger.info('create gpt4 ok!'));
      const [appid, left] = await Promise.all([
        this.getToken(page),
        this.getLeft(page),
      ]);
      return [appid, left];
    } catch (e) {
      this.logger.error('get info failed, retry', e);
      return [];
    }
  }

  async createGPT4(page: Page) {
    try {
      await page.waitForSelector(
        '.ant-layout-content > .body-wrap > div > .dashboard-content > .template-card:nth-child(1)',
      );
      await sleep(3000);
      await page.click(
        '.ant-layout-content > .body-wrap > div > .dashboard-content > .template-card:nth-child(1)',
      );
    } catch (e) {}
  }

  async getToken(page: Page) {
    const res = await page.waitForResponse(
      (req) => req.url().indexOf('https://ai.vanus.ai/api/ai/apps/') > -1,
    );
    const data = await res.json();
    console.log('get token ok!', data.api_id);
    return data.api_id;
  }

  async getLeft(page: Page) {
    const res = await page.waitForResponse(
      (req) => req.url().indexOf('https://ai.vanus.ai/api/quotas') > -1,
    );
    const data: {
      quota_items: { total: number; type: string; used: number }[];
    } = await res.json();
    for (const v of data.quota_items) {
      if (v.type === 'credits') {
        console.log('get left ok!', JSON.stringify(v));
        return v;
      }
    }
    return { total: 0, used: 0 };
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    try {
      account.left -= req.model === ModelType.GPT4 ? 20 : 1;
      const res = await this.client.post(
        `https://ai.vanus.ai/api/chat/${account.appid}`,
        {
          prompt: req.prompt,
          stream: true,
          no_history: true,
        },
        {
          headers: {
            'X-Vanusai-Model': req.model,
          },
          responseType: 'stream',
        },
      );
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const data = chunk.toString().replace('data: ', '');
          if (!data) {
            return;
          }
          const res = parseJSON<{
            token: string;
            more: boolean;
            time?: number;
          }>(data, { token: '', more: false });
          if (res.token) {
            stream.write(Event.message, { content: res.token });
          }
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        done(account);
        if (account.left < 20) {
          destroy(true);
        }
      });
    } catch (e: any) {
      stream.write(Event.error, { error: e.message });
      stream.write(Event.done, { content: '' });
      stream.end();
      destroy();
    }
  }
}
