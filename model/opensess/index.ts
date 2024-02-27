import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  parseJSON,
  randomStr,
  randomUserAgent,
  sleep,
} from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateNewAxios, CreateNewPage } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page, Protocol } from 'puppeteer';
import es from 'event-stream';
import { CreateEmail } from '../../utils/emailFactory';
import { AxiosInstance } from 'axios';
import { AxiosRequestConfig } from 'axios/index';

interface RealReq extends ChatRequest {
  functions?: {
    name: string;
    description?: string;
    parameters: object;
  };
  function_call?: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: {};
  user?: string;
}

const ParamsList = [
  'model',
  'messages',
  'functions',
  'function_call',
  'temperature',
  'top_p',
  'n',
  'stream',
  'stop',
  'max_tokens',
  'presence_penalty',
  'frequency_penalty',
  'logit_bias',
  'user',
  'gizmo_id',
];

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

interface Account extends ComInfo {
  email: string;
  password: string;
  token: string;
  sess: string;
}

class Child extends ComChild<Account> {
  public page!: Page;
  public client: AxiosInstance = CreateNewAxios({
    baseURL: 'https://api.openai.com/',
  });

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  async init(): Promise<void> {
    let page: Page;
    try {
      page = await CreateNewPage('https://platform.openai.com/signup', {
        stealth: true,
        protocolTimeout: 15 * 1000,
        fingerprint_inject: false,
      });

      await page.waitForSelector('#email', {
        timeout: 60 * 1000,
      });
      const mail = CreateEmail(Config.config.opensess.mail_type);
      const email = await mail.getMailAddress();
      await page.type('#email', email);
      await page.click('button[type="submit"]');

      const password = randomStr(25);
      await page.waitForSelector('#password');
      await page.type('#password', password);
      await page.click('button[type="submit"]');

      let redirectUrl = '';
      for (const v of await mail.waitMails()) {
        redirectUrl = (v as any).content.match(/href="([^"]*)/i)[1];
        if (redirectUrl) {
          break;
        }
      }
      if (!redirectUrl) {
        throw new Error('redirectUrl not found');
      }
      await page.goto(redirectUrl);
      await page.waitForSelector('input[placeholder="Full name"]');
      await page.type('input[placeholder="Full name"]', randomStr(12));

      await page.waitForSelector('input[placeholder="Birthday"]');
      await page.click('input[placeholder="Birthday"]');
      await page.keyboard.type('01011990', { delay: 100 });

      await page.waitForSelector('button[type="submit"]');
      await page.click('button[type="submit"]');
      await page.waitForSelector('.avatar', { timeout: 30 });
      await this.updateToken();
      await this.updateSess();
    } catch (e) {
      this.page?.browser().close();
      this.logger.error(`init failed, email:${this.info.email}`);
      throw e;
    }
  }

  async getToken() {
    for (const v in localStorage) {
      if (v.indexOf('https://api.openai.com/v1::openid') === -1) {
        const value = parseJSON(
          localStorage[v],
          {} as { body: { access_token: string } },
        );
        return value.body.access_token;
      }
    }
    return null;
  }

  async updateToken() {
    const token = await this.getToken();
    if (!token) {
      throw new Error('token not found');
    }
    this.update({ token });
  }

  async updateSess() {
    const res = await this.client.post(
      'https://api.openai.com/',
      {},
      {
        headers: {
          'User-Agent': randomUserAgent(),
          Authorization: `Bearer ${this.info.token}`,
        },
      },
    );
    const {
      user: {
        session: { sensitive_id },
      },
    } = res.data as { user: { session: { sensitive_id: string } } };
    this.update({ sess: sensitive_id });
  }

  async destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser()?.close();
  }

  initFailed() {
    this.page?.browser()?.close();
    this.options?.onInitFailed({ delFile: false, delMem: true });
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class OpenSess extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.opensess.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.sess) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.opensess.serial || 1,
      needDel: (v) => !v.sess,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 6000;
      case ModelType.GPT3p5_16k:
        return 12000;
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
    const data: RealReq = {
      ...req,
      messages: req.messages,
      model: req.model,
      stream: true,
    };
    for (const key in data) {
      if (ParamsList.indexOf(key) === -1) {
        delete (data as any)[key];
      }
    }
    try {
      const res = await child.client.post('/v1/chat/completions', data, {
        responseType: 'stream',
        headers: {
          Authorization: `Bearer ${child.info.sess}`,
        },
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            stream.write(Event.error, { error: 'not found data.choices' });
            stream.end();
            return;
          }
          const choices = data.choices || [];
          const { delta, finish_reason } = choices[0] || {};
          if (finish_reason === 'stop') {
            return;
          }
          if (delta) {
            stream.write(Event.message, delta);
          }
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      this.logger.error(e.message);
      e.response.data.on('data', (chunk: any) =>
        this.logger.error(chunk.toString()),
      );
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
