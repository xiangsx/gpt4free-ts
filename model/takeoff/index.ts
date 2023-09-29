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
import { CreateEmail } from '../../utils/emailFactory';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import es from 'event-stream';

const ModelMap: Partial<Record<ModelType, number>> = {
  [ModelType.GPT4]: 15,
  [ModelType.GPT3p5Turbo]: 1,
  [ModelType.GPT3p5_16k]: 2,
};

interface Account extends ComInfo {
  email: string;
  password: string;
  left: number;
  ckkey: string;
  ckvalue: string;
}

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://www.takeoffchat.com',
      },
      false,
    );
  }

  async init(): Promise<void> {
    if (this.info.ckkey && this.info.ckvalue) {
      return;
    }
    try {
      let page;
      this.logger.info('register new account ...');
      page = await CreateNewPage('https://www.takeoffchat.com/login');
      this.page = page;

      await page.evaluate(() => {
        window.alert = () => {};
      });
      await page.waitForSelector('#email');
      await page.click('#email');
      const mailbox = CreateEmail(Config.config.takeoff.mailType);
      const email = await mailbox.getMailAddress();
      await page.keyboard.type(email);
      this.update({ email });

      await page.waitForSelector(
        '.grid > form > .grid > .grid > .flex:nth-child(2)',
      );
      await page.click('.grid > form > .grid > .grid > .flex:nth-child(2)');
      const password = randomStr(20);
      await page.keyboard.type(password);
      this.update({ password });

      await page.keyboard.press('Enter');
      await page.waitForSelector(
        '.mx-auto > .grid > form > .grid > .inline-flex',
      );
      await page.click('.mx-auto > .grid > form > .grid > .inline-flex');

      for (const v of await mailbox.waitMails()) {
        let verifyUrl = v.content.match(/href="([^"]*)/i)?.[1] || '';
        if (!verifyUrl) {
          throw new Error('verifyUrl not found');
        }
        verifyUrl = verifyUrl.replace(/&amp;/g, '&');
        const vPage = await page.browser().newPage();
        await vPage.goto(verifyUrl);
      }
      await sleep(3000);
      await page.bringToFront();
      await page.waitForSelector(
        '.mx-auto > .grid > form > .grid > .inline-flex',
      );
      await page.click('.mx-auto > .grid > form > .grid > .inline-flex');

      await page.waitForSelector('div.grid > div:nth-child(1) > button');
      await page.click('div.grid > div:nth-child(1) > button');
      const cookie = await this.getCookie(page);
      if (!cookie) {
        throw new Error('get cookie failed');
      }
      this.update({ ckkey: cookie.name, ckvalue: cookie.value, left: 20000 });
      page.browser().close();
    } catch (e) {
      throw e;
    }
  }

  async getCookie(page: Page) {
    const cookies = await page.cookies();
    const cookie = cookies.find((v) => v.name.endsWith('auth-token'));
    return cookie;
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser()?.close();
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class TakeOff extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.takeoff.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.ckkey || !v.ckvalue) {
        return false;
      }
      if (v.left < 0) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: () => Config.config.takeoff.serial || 1 },
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
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    let tokenSize =
      1 +
      getTokenCount(req.messages.reduce((prev, cur) => prev + cur.content, ''));
    let output = '';
    try {
      const res = await child.client.post(
        '/api/chat',
        {
          messages: req.messages,
          model: req.model,
          prompt: '1',
          temperature: [1],
          lookbackWindow: req.model === ModelType.GPT3p5Turbo ? 1000 : 3000,
          displayName: null,
          profileContext: null,
          workspaceInstructions: '',
          chatName: 'New Chat',
          chatId: v4(),
          documentId: null,
        },
        {
          headers: {
            Cookie: `${child.info.ckkey}=${child.info.ckvalue}`,
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
        tokenSize += getTokenCount(output);
        const consumeToken = (ModelMap[req.model] || 1) * tokenSize;
        child.update({ left: child.info.left - consumeToken });
        this.logger.debug(`consume: ${consumeToken}, left: ${child.info.left}`);
        if (child.info.left < 0) {
          child.destroy({ delFile: true, delMem: true });
        }
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
