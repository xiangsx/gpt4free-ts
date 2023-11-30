import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  ModelType,
} from '../base';
import { CDPSession, Page, Protocol } from 'puppeteer';
import {
  Event,
  EventStream,
  htmlToMarkdown,
  maskLinks,
  parseJSON,
  randomStr,
  sleep,
} from '../../utils';
import { Config } from '../../utils/config';
import { ComChild, ComInfo, DestroyOptions, Pool } from '../../utils/pool';
import { CreateNewPage } from '../../utils/proxyAgent';
import { CreateEmail } from '../../utils/emailFactory';
import * as cheerio from 'cheerio';

interface RealAck {
  messages: string[];
  min_seq: number;
}

interface Account extends ComInfo {
  email: string;
  cookies: Protocol.Network.CookieParam[];
  use_left: number;
  use_out_time: number;
}

type Events = {
  onMsg: (msg: string) => void;
  onError: (err: Error) => void;
  onEnd: (msg: string) => void;
};

class Child extends ComChild<Account> {
  private page!: Page;
  private events?: Events;
  private refresh?: () => void;
  private client!: CDPSession;

  isMsg(msg: string): boolean {
    if (msg.indexOf('ai_chat_message_') === -1) {
      return false;
    }
    return true;
  }

  InputSelector = `textarea[name="ai_chat[prompt]"]`;

  async startListener() {
    const client = await this.page.target().createCDPSession();
    this.client = client;
    await client.send('Network.enable');
    let currMsgID = '';
    client.on('Network.webSocketFrameReceived', async ({ response }) => {
      try {
        const msg = response.payloadData;
        if (!this.isMsg(msg)) {
          return;
        }
        const data = parseJSON<{ message: string }>(msg, {} as any);
        if (!data.message) {
          return;
        }
        const { message } = data;
        // <span id="ai_chat_message_2222_body" class="markdown-body" data-copy-to-clipboard-target="copySource" data-controller="message" data-message-text-streaming-value="true" data-message-scroll-into-view-value="false"><p>冒泡排序是一种</p>
        // </span>

        if (message.indexOf('action="replace"') === -1) {
          return;
        }

        let content = cheerio.load(message)('span').html();
        if (!content) {
          return;
        }
        content = htmlToMarkdown(content);
        if (message.indexOf('data-message-text-streaming-value="false"') > -1) {
          this.events?.onEnd(content);
          return;
        }
        this.refresh?.();
      } catch (e) {
        this.logger.warn('parse failed, ', e);
      }
    });
    this.logger.info('start listener ok');
    return client;
  }

  decUseLeft() {
    this.update({ use_left: this.info.use_left - 2 });
    if (this.info.use_left < 2) {
      this.destroy({ delFile: true, delMem: true });
      this.logger.info('use left < 2, destroy');
      return;
    }
    this.destroy({ delFile: false, delMem: true });
  }

  async sendMsg(model: ModelType, prompt: string, events?: Events) {
    try {
      const delay = setTimeout(async () => {
        this.events?.onError(new Error('timeout'));
      }, 60 * 1000);
      this.events = {
        onEnd: async (msg: string) => {
          delete this.events;
          await this.clearContext();
          clearTimeout(delay);
          events?.onEnd(msg);
          this.decUseLeft();
        },
        onError: async (err: Error) => {
          delete this.events;
          await this.clearContext();
          clearTimeout(delay);
          events?.onError(err);
          this.decUseLeft();
        },
        onMsg(msg: string): void {
          events?.onMsg(msg);
          delay.refresh();
        },
      };
      const page = this.page;
      await page.waitForSelector(this.InputSelector);
      await page.click(this.InputSelector);
      await page.keyboard.type('-');

      await this.client.send('Input.insertText', { text: prompt });
      await page.waitForSelector(
        `#ai_generate > button:not([disabled="true"])`,
      );
      await page.click(`#ai_generate > button:not([disabled="true"])`);
      this.logger.info('send msg ok!');
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  public async updateUseLeft(page: Page) {
    const str = await page.evaluate(
      () =>
        document.querySelector(
          `button[data-bs-target="#creator-subscription"] > div > span`,
        )?.textContent || '',
    );
    const match = str.match(/\d+/); // 正则表达式匹配连续的数字
    if (!match) {
      throw new Error('use_left not found');
    }
    const use_left = parseInt(match[0], 10);
    this.update({ use_left });
    this.logger.info(`use_left: ${use_left}`);
  }

  public async clearContext() {
    await this.page.goto('https://izea.com/ai/chat/chat_gpt');
  }

  public async updateToken(page: Page) {
    const cookies = await page.cookies();
    const token = cookies.filter(
      (v) =>
        ['messagesUtk', '_mar_token', '_marketplace_session'].indexOf(v.name) >
        -1,
    );
    if (!token.length) {
      throw new Error('token not found');
    }
    this.update({ cookies: token });
  }

  async init(): Promise<void> {
    try {
      let page;
      if (this.info.cookies?.length) {
        this.logger.info('login with token ...');
        page = await CreateNewPage('https://izea.com', {
          cookies: this.info.cookies,
        });
        this.page = page;
      } else {
        this.logger.info('register new account ...');
        page = await CreateNewPage(`https://izea.com`, {
          simplify: false,
        });
        this.page = page;

        await page.waitForSelector(
          '#nav > .d-flex > .dropdown > #accountNavbarDropdown > .avatar',
        );
        await page.click(
          '#nav > .d-flex > .dropdown > #accountNavbarDropdown > .avatar',
        );

        await page.waitForSelector(
          '#nav > .d-flex > .dropdown > .dropdown-menu > .dropdown-item:nth-child(4)',
        );
        await page.click(
          '#nav > .d-flex > .dropdown > .dropdown-menu > .dropdown-item:nth-child(4)',
        );
        await page.waitForSelector(`input[type="email"]`);
        await sleep(1000);
        await page.click(`input[type="email"]`);
        const mailbox = CreateEmail(Config.config.izea.mail_type);
        const email = await mailbox.getMailAddress();
        await page.keyboard.type(email);
        this.update({ email });
        await page.keyboard.press('Enter');

        await page.waitForSelector(`input[placeholder="Name"]`);
        await sleep(1000);
        await page.click(`input[placeholder="Name"]`);
        await page.keyboard.type(randomStr(20));

        const password =
          randomStr(10) + '1' + randomStr(4) + 'A' + randomStr(3) + '.';
        await page.waitForSelector(`input[placeholder="Password"]`);
        await page.click(`input[placeholder="Password"]`);
        await page.keyboard.type(password);
        await sleep(2000);
        await page.keyboard.press('Enter');

        let verifyCode: string = '';
        for (const v of await mailbox.waitMails()) {
          verifyCode = (v as any).content.match(/>(\d{6})</i)?.[1] || '';
          if (verifyCode) {
            break;
          }
        }
        if (!verifyCode) {
          throw new Error('verifyCode not found');
        }
        await page.waitForSelector(`input[placeholder="Verification Code"]`);
        await sleep(1000);
        await page.click(`input[placeholder="Verification Code"]`);
        await page.keyboard.type(verifyCode);
        await sleep(2000);
        await page.keyboard.press('Enter');

        await page.waitForSelector('form:nth-child(3) > button');
        await page.click('form:nth-child(3) > button');

        await page.waitForSelector(`a[href="/ai/text/social_post"]`);
        await page.click(`a[href="/ai/text/social_post"]`);
        await sleep(1000);
      }

      await page.goto('https://izea.com/ai/chat/chat_gpt');
      await sleep(1000);
      await this.updateToken(page);
      await this.updateUseLeft(page);
      await this.startListener();
    } catch (e) {
      throw e;
    }
  }

  initFailed() {
    this.options?.onInitFailed({ delFile: true, delMem: true });
    this.page?.browser?.().close?.();
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser?.().close?.();
  }
}

export class Izea extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.izea.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.cookies?.length) {
        return false;
      }
      if (v.use_left < 2) {
        return false;
      }
      return true;
    },
    {
      delay: 3000,
      serial: () => Config.config.izea.serial || 1,
      needDel: (info) => !info.cookies?.length,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    const reqH = await super.preHandle(req, {
      token: true,
      countPrompt: true,
      forceRemove: true,
    });
    if (reqH.model === ModelType.StableDiffusion) {
      reqH.prompt = contentToString(
        reqH.messages[req.messages.length - 1].content,
      );
    }
    if (reqH.model.indexOf('claude') > -1) {
      reqH.prompt = reqH.prompt.replace(/user:/g, 'Human:');
      reqH.prompt = reqH.prompt.replace(/assistant:/g, 'Result:');
    }
    reqH.prompt = reqH.prompt.replace(/assistant:/g, 'result:');
    reqH.prompt = maskLinks(reqH.prompt);
    return reqH;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    let old = '';
    await child.sendMsg(req.model, req.prompt, {
      onError: (err) => {
        stream.write(Event.error, { error: err.message });
        stream.write(Event.done, { content: '' });
        stream.end();
      },
      onEnd: (msg) => {
        stream.write(Event.message, { content: msg.substring(old.length) });
        stream.write(Event.done, { content: '' });
        stream.end();
        this.logger.info('Recv msg ok');
      },
      onMsg: (msg) => {
        if (req.model === ModelType.StableDiffusion) {
          stream.write(Event.message, { content: '' });
          return;
        }
        stream.write(Event.message, { content: msg.substring(old.length) });
        old = msg;
      },
    });
  }
}
