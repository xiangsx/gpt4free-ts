import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  getTokenCount,
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

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: `https://${Config.config.td.domain}/api`,
      },
      false,
    );
  }

  async init(): Promise<void> {
    try {
      let page;
      if (this.info.refresh_token) {
        this.logger.info('login...');
        page = await CreateNewPage(`https://${Config.config.td.domain}/login`);
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
        page = await CreateNewPage(
          `https://${Config.config.td.domain}/register`,
        );
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
      await sleep(5000);
      await this.saveRefreshToken(page);
      await this.updateAuth();

      page.browser().close();
    } catch (e) {
      throw e;
    }
  }

  async updateAuth() {
    const res: { data: { token: string } } = await this.client.post(
      '/auth/refresh',
      {},
      {
        headers: {
          Cookie: `refreshToken=${this.info.refresh_token}`,
        },
      },
    );
    if (!res.data.token) {
      this.destroy({ delFile: true, delMem: true });
      throw new Error('refresh auth failed');
    }
    this.update({ token: res.data.token });
    this.logger.info('update auth ok');
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
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser()?.close();
  }
}

export class TD extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    `${this.options?.name}_${Config.config.td.domain}` || '',
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
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
            referrer: `https://${Config.config.td.domain}/chat/new`,
            Origin: `https://${Config.config.td.domain}`,
            host: `${Config.config.td.domain}`,
          },
          responseType: 'stream',
        },
      );
      let old = '';
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any) => {
          const content = chunk
            .toString()
            .replace(`event: message\ndata: `, '');
          const data = parseJSON<{ text: string; message: boolean }>(
            content,
            {} as any,
          );
          if (!data.text || !data.message) {
            return;
          }
          if (data.text.length > old.length) {
            stream.write(Event.message, {
              content: data.text.substring(old.length),
            });
            old = data.text;
          }
        }),
      );
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
        child.release();
      });
    } catch (e: any) {
      e.response.data.on('data', (chunk: any) =>
        this.logger.info(chunk.toString()),
      );
      this.logger.error('ask failed, ', e);
      stream.write(Event.error, {
        error: 'Something error, please retry later',
        status: 500,
      });
      stream.write(Event.done, { content: '' });
      stream.end();
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
