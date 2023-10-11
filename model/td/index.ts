import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  getTokenCount,
  randomStr,
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
import { CreateAxiosProxy, CreateNewPage } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import es from 'event-stream';

interface Account extends ComInfo {
  email: string;
  password: string;
  refresh_token: string;
  token: string;
  expires: number;
}

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;
  refreshTokenItl!: NodeJS.Timer;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://thedifferenceai.com/api',
      },
      false,
    );
  }

  async init(): Promise<void> {
    try {
      let page;
      if (this.info.refresh_token) {
        this.logger.info('login...');
        page = await CreateNewPage('https://thedifferenceai.com/register');
        this.page = page;
        await page.waitForSelector('#email');
        await page.click('#email');
        await page.keyboard.type(this.info.email);

        await page.waitForSelector('#password');
        await page.click('#password');
        await page.keyboard.type(this.info.password);

        await page.waitForSelector(`button[type="submit"]`);
        await page.click(`button[type="submit"]`);
      } else {
        this.logger.info('register new account ...');
        page = await CreateNewPage('https://thedifferenceai.com/register');
        this.page = page;

        await page.waitForSelector('#name');
        await page.click('#name');
        await page.keyboard.type(randomStr(8));

        await page.waitForSelector('#username');
        await page.click('#username');
        await page.keyboard.type(randomStr(8));

        await page.waitForSelector('#email');
        await page.click('#email');
        const email = randomStr(16) + '@gmail.com';
        await page.keyboard.type(email);

        await page.waitForSelector('#password');
        await page.click('#password');
        const password = randomStr(20);
        await page.keyboard.type(password);

        await page.waitForSelector('#confirm_password');
        await page.click('#confirm_password');
        await page.keyboard.type(password);
        this.update({ email, password });

        await page.waitForSelector(`button[type="submit"]`);
        await page.click(`button[type="submit"]`);
      }

      await page.waitForNavigation();
      await this.saveRefreshToken(page);
      await this.refreshAuth();

      page.browser().close();
    } catch (e) {
      throw e;
    }
  }

  async refreshAuth() {
    const res: { data: { token: string } } = await this.client.post(
      '/auth/refresh',
    );
    this.update({ token: res.data.token });
    this.logger.info('refresh auth ok');
    if (!this.refreshTokenItl) {
      this.refreshTokenItl = setInterval(() => {
        this.refreshAuth();
      });
    }
  }

  async saveRefreshToken(page: Page) {
    const cookies = await page.cookies();
    const cookie = cookies.find((v) => v.name.endsWith('refreshToken'));
    if (!cookie) {
      throw new Error('get cookie failed');
    }
    this.update({ refresh_token: cookie.value, expires: cookie.expires });
    this.logger.info('save refresh token ok');
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: false, delMem: true });
    clearInterval(this.refreshTokenItl);
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser()?.close();
    clearInterval(this.refreshTokenItl);
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class TD extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.td.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.refresh_token) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: () => Config.config.td.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5_16k:
        return 13000;
      case ModelType.GPT3p5Turbo:
        return 3000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    let output = '';
    try {
      const res = await child.client.post(
        '/ask/openAI',
        {
          sender: 'User',
          text: req.prompt,
          current: true,
          isCreatedByUser: true,
          parentMessageId: '00000000-0000-0000-0000-000000000000',
          conversationId: null,
          messageId: v4(),
          error: false,
          generation: '',
          responseMessageId: null,
          overrideParentMessageId: null,
          model: req.model,
          chatGptLabel: null,
          promptPrefix: null,
          temperature: 1,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          endpoint: 'openAI',
          key: null,
          isContinued: false,
        },
        {
          headers: {
            accept: '*/*',
            'accept-language':
              'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            Authorization: `Bearer ${child.info.token}`,
            Cookie: `refreshToken=${child.info.refresh_token}`,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            pragma: 'no-cache',
            'sec-ch-ua':
              '"Microsoft Edge";v="117", "Not;A=Brand";v="8", "Chromium";v="117"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            referrer: 'https://thedifferenceai.com/chat/new',
            Origin: 'https://thedifferenceai.com',
            host: 'thedifferenceai.com',
          },
          responseType: 'stream',
        },
      );
      res.data.pipe(
        es.map((chunk: any) => {
          const content = chunk.toString();
          output += content;
          stream.write(Event.message, { content });
        }),
      );
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      this.logger.error('ask failed, ', e);
      stream.write(Event.error, {
        error: 'Something error, please retry later',
        status: 500,
      });
      stream.write(Event.done, { content: '' });
      stream.end();
      child.destroy({ delFile: true, delMem: true });
    }
  }
}
