import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Page } from 'puppeteer';
import {
  Event,
  EventStream,
  parseJSON,
  randomStr,
  randomUserAgent,
  sleep,
} from '../../utils';

import moment from 'moment';
import { CreateAxiosProxy, CreateNewPage } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import es from 'event-stream';
import { ComChild, ComInfo, Pool } from '../../utils/pool';
import { CreateEmail } from '../../utils/emailFactory';
import { Config } from '../../utils/config';

const ModelMap: Partial<Record<ModelType, any>> = {
  [ModelType.GPT4]: '01c8de4fbfc548df903712b0922a4e01',
  [ModelType.GPT3p5Turbo]: '8077335db7cd47e29f7de486612cc7fd',
};

const MaxFailedTimes = 10;

interface Account extends ComInfo {
  email?: string;
  password?: string;
  login_time?: string;
  appid?: string;
  failedCnt: number;
  token: string;
  left: number;
}

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

class Child extends ComChild<Account> {
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

  async init(): Promise<void> {
    if (!this.info.appid) {
      const page = await CreateNewPage('https://ai.vanus.ai/');
      await sleep(5000);

      await page.waitForSelector('#a-signup');
      await page.click('#a-signup');

      await page.waitForSelector('#signup-email');
      await page.click('#signup-email');
      const mailbox = CreateEmail(Config.config.langdock.mail_type);
      const email = await mailbox.getMailAddress();
      await page.keyboard.type(email, { delay: 10 });

      const password = `${randomStr(5)}A${randomStr(5)}v${randomStr(
        5,
      )}1${randomStr(5)}`;
      await page.waitForSelector('#signup-password');
      await page.click('#signup-password');
      await page.keyboard.type(password, { delay: 10 });
      this.update({ email, password });

      await page.waitForSelector(
        '.widget-container > #sign-up > form > #checkbox > input',
      );
      await page.click(
        '.widget-container > #sign-up > form > #checkbox > input',
      );

      await page.keyboard.press('Enter');
      await page.waitForSelector('#btn-signup');
      await page.click('#btn-signup');

      for (const v of await mailbox.waitMails()) {
        let verifyUrl = v.content.match(/href="([^"]*)/i)?.[1] || '';
        if (!verifyUrl) {
          throw new Error('verifyUrl not found');
        }
        verifyUrl = verifyUrl.replace(/&amp;/g, '&');
        await page.goto(verifyUrl);
        this.logger.info('verify email ok');
      }

      await page.goto('https://ai.vanus.ai/dashboard');
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
        this.update({ appid, left: left.total - left.used });
        break;
      }
    }
  }

  public use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class Vanus extends Chat {
  private client: AxiosInstance;
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.vanus.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.appid) {
        return false;
      }
      if (v.left < 20) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: 1 },
  );
  constructor(options?: ChatOptions) {
    super(options);
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

  public async askStream(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    try {
      child.update({
        left: child.info.left - (req.model === ModelType.GPT4 ? 20 : 1),
      });
      this.logger.info(`${child.info.email} left: ${child.info.left}`);
      const res = await this.client.post(
        `https://ai.vanus.ai/api/chat/${child.info.appid}`,
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
        if (child.info.left < 20) {
          this.logger.info('account left < 20, register new now!');
          child.destroy({ delFile: true, delMem: true });
          return;
        }
        child.release();
      });
    } catch (e: any) {
      stream.write(Event.error, { error: e.message });
      stream.write(Event.done, { content: '' });
      stream.end();
      if (e.response.status === 403) {
        this.logger.error(`account ${child.info.email} has been baned`);
        child.destroy({ delFile: true, delMem: true });
        return;
      }
      child.update({ failedCnt: child.info.failedCnt + 1 });
      if (child.info.failedCnt > 5) {
        this.logger.warn(
          `account ${child.info.email} failed too many times! left:${child.info.left}`,
        );
        child.destroy({ delFile: true, delMem: true });
        return;
      }
      this.logger.error('ask failed, ', e);
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
