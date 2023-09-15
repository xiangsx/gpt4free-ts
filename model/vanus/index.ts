import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Browser, Page } from 'puppeteer';
import { BrowserPool, BrowserUser, simplifyPage } from '../../utils/puppeteer';
import {
  Event,
  EventStream,
  parseJSON,
  randomStr,
  randomUserAgent,
  shuffleArray,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';

import fs from 'fs';
import moment from 'moment';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import es from 'event-stream';
import { getCaptchaCode } from '../../utils/captcha';

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
    this.pool = this.pool.filter((v) => v.id !== id);
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
    let size = +(process.env.VANUS_POOL_SIZE || 0);
    if (size > 30) {
      size = 10;
    }
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
          'User-Agent': randomUserAgent(),
          'x-vanusai-host': 'ai.vanus.ai',
        },
      },
      true,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 6000;
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.ErnieBot:
        return 2000;
      case ModelType.ErnieBotTurbo:
        return 2000;
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

  getRandomMail() {
    return `${randomStr(15 + Math.random() * 5)}@${
      Math.random() > 0.5 ? 'gmail' : 'outlook'
    }.com`.toLowerCase();
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

        await page.waitForSelector('section > div > div > div > div > p > a');
        await page.click('section > div > div > div > div > p > a');

        await page.waitForSelector('#email');
        await page.click('#email');

        account.email = this.getRandomMail();
        account.password = `${randomStr(5)}A${randomStr(5)}v${randomStr(
          5,
        )}1${randomStr(5)}`;
        await page.keyboard.type(account.email, { delay: 10 });

        let handleCaptcha = false;
        for (let i = 0; i < 3; i++) {
          await page.waitForSelector('#password');
          await page.click('#password');
          await page.keyboard.type(account.password, { delay: 10 });

          const ok = await this.handleCaptcha(page);
          if (ok) {
            handleCaptcha = true;
            break;
          }
        }
        if (!handleCaptcha) {
          throw new Error('Handle captcha failed, register new account!');
        }

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
      // await page.screenshot({ path: `./run/error_${account.id}.png` });
      await browser.close();
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      return [] as any;
    }
  }

  async handleCaptcha(page: Page) {
    try {
      // 选择你想要截图的元素
      const element = await page.$('div > div > img');
      if (!element) {
        this.logger.error('got captcha img failed');
        return false;
      }
      this.logger.info('start handle capture!');
      // 对该元素进行截图并获得一个 Buffers
      const imageBuffer = await element.screenshot();
      // 将 Buffer 转换为 Base64 格式的字符串
      const base64String = imageBuffer.toString('base64');
      const captcha = await getCaptchaCode(base64String);
      if (!captcha) {
        this.logger.error('got captcha failed');
        return false;
      }
      this.logger.info(`got capture ${captcha}`);
      await page.waitForSelector('#captcha');
      await page.click('#captcha');
      await page.keyboard.type(captcha);
      await page.keyboard.press('Enter');
      await page.waitForSelector('#error-element-captcha', {
        timeout: 5 * 1000,
      });
      return false;
    } catch (e) {
      this.logger.info('handle capture ok!');
      return true;
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
    this.logger.info('get token ok!', data.api_id);
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
        this.logger.info('get left ok!', JSON.stringify(v));
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
      this.accountPool.syncfile();
      this.logger.info(`${account.email} left: ${account.left}`);
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
          try {
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
          } catch (e) {
            this.logger.error('parse data failed, ', e);
          }
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        if (account.left < 20) {
          this.logger.info('account left < 20, register new now!');
          destroy(true);
          return;
        }
        done(account);
      });
    } catch (e: any) {
      stream.write(Event.error, { error: e.message });
      stream.write(Event.done, { content: '' });
      stream.end();
      if (e.response.status === 403) {
        this.logger.error(`account ${account.email} has been baned`);
        destroy(true);
        return;
      }
      account.failedCnt++;
      if (account.failedCnt > 5) {
        this.logger.warn(
          `account ${account.email} failed too many times! left:${account.left}`,
        );
        destroy(true);
        return;
      }
      this.logger.error('ask failed, ', e);
      destroy();
    }
  }
}
