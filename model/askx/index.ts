import {
  Chat,
  ChatOptions,
  ChatRequest,
  messagesToPrompt,
  ModelType,
} from '../base';
import {
  Event,
  EventStream,
  getTokenCount,
  parseJSON,
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
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import es from 'event-stream';

interface Account extends ComInfo {
  email: string;
  password: string;
  xsrf_token: string;
  askx_session: string;
}

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://askx.ai',
      },
      false,
    );
  }

  async init(): Promise<void> {
    try {
      let page;
      if (this.info.xsrf_token && this.info.askx_session) {
        this.logger.info('login...');
        page = await CreateNewPage('https://askx.ai/login');
        this.page = page;
        await page.waitForSelector(`input[name="email"]`);
        await page.click(`input[name="email"]`);
        await page.keyboard.type(this.info.email);
        await page.waitForSelector(`input[name="password"]`);
        await page.click(`input[name="password"]`);
        await page.keyboard.type(this.info.password);
        await page.waitForSelector(`button[type="submit"]`);
        await page.click(`button[type="submit"]`);
      } else {
        this.logger.info('register new account ...');
        page = await CreateNewPage('https://askx.ai/register');
        this.page = page;

        await page.waitForSelector(`input[name="name"]`);
        await page.click(`input[name="name"]`);
        await page.keyboard.type(
          randomStr(10 + Math.floor(Math.random() * 10)),
        );
        await page.waitForSelector(`input[name="email"]`);
        await page.click(`input[name="email"]`);

        const email = `${randomStr(20)}@gmail.com`;
        await page.keyboard.type(email);
        this.update({ email });

        await page.waitForSelector(`input[type="password"]`);
        await page.click(`input[type="password"]`);
        const password = randomStr(20);
        await page.keyboard.type(password);
        this.update({ password });

        await page.waitForSelector(`button[type="submit"]`);
        await page.click(`button[type="submit"]`);
      }

      await page.waitForSelector(`a[href="https://askx.ai/dashboard/chat"]`);
      await sleep(3000);
      await this.updateToken(page);
      page.browser().close();
    } catch (e) {
      throw e;
    }
  }

  async updateToken(page: Page) {
    const cookies = await page.cookies();
    const xsrf = cookies.find((v) => v.name === 'XSRF-TOKEN');
    if (!xsrf) {
      throw new Error('get xsrf failed');
    }
    this.update({ xsrf_token: xsrf.value });
    const askx = cookies.find((v) => v.name === 'askx_session');
    if (!askx) {
      throw new Error('get askx failed');
    }
    this.update({ askx_session: askx.value });
    this.logger.info('update token ok');
  }

  initFailed() {
    this.page
      ?.browser()
      .close()
      .catch((e) => this.logger.error(e.message));
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class Askx extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.askx.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.askx_session || !v.xsrf_token) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: () => Config.config.askx.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 850;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: false,
      countPrompt: true,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    let tokenSize =
      1 +
      getTokenCount(req.messages.reduce((prev, cur) => prev + cur.content, ''));
    try {
      const res = await child.client.get('/dashboard/chat/stream', {
        params: {
          role: 'user',
          content: req.prompt,
        },
        headers: {
          Cookie: `XSRF-TOKEN=${child.info.xsrf_token}; askx_session=${child.info.askx_session}`,
        },
        responseType: 'stream',
      });
      res.data
        .pipe(
          es.map((chunk: any, cb: any) => {
            const content = chunk
              .toString()
              .replace('data: ', '')
              .replace('finishReasonstop', '');
            cb(null, parseJSON(content, ''));
          }),
        )
        .on('data', (chunk: string | { message: string }) => {
          res.data.pause();
          if (typeof chunk !== 'string') {
            stream.write(Event.error, { error: chunk?.message });
            child.destroy({ delFile: true, delMem: true });
          } else {
            stream.write(Event.message, { content: chunk });
          }
          res.data.resume();
        });
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      this.logger.error('ask failed, ', e.message);
      e.response.data.on('data', (chunk: any) =>
        this.logger.info(chunk.toString()),
      );
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
