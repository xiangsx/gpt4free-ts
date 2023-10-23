import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream } from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateNewPage, WebFetchWithPage } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { Page } from 'puppeteer';
import es from 'event-stream';
import { CreateEmail } from '../../utils/emailFactory';
import { handleCF, ifCF } from '../../utils/captcha';

interface Account extends ComInfo {
  email: string;
  token: string;
  expire_time: number;
  left: number;
  user_out_time: number;
}

const modelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT3p5Turbo]: 'GPT-3.5-Turbo',
  [ModelType.GPT4]: 'GPT-4',
};

class Child extends ComChild<Account> {
  public client!: WebFetchWithPage;
  public page!: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  async ifLogin() {
    const page = this.page;
    try {
      await page.waitForSelector('.fe.fe-user', { timeout: 10 * 1000 });
      return true;
    } catch (e) {
      return false;
    }
  }

  async updateLeft() {
    const page = this.page;
    const content = await page.evaluate(
      // @ts-ignore
      () => document.querySelector('li > div > p > .text-primary').textContent,
    );
    if (!content) {
      throw new Error('get left failed, content is empty');
    }
    const match = content.match(/(\d+)/);
    if (!match) {
      throw new Error('No number found in input string.');
    }
    const left = parseInt(match[0]);
    this.update({ left });
    this.logger.info('update left ok');
    if (!left) {
      throw new Error('no left');
    }
  }

  async updateToken() {
    const page = this.page;
    const cookies = await page.cookies('https://www.phind.com');
    //__Secure-next-auth.session-token
    const token = cookies.find(
      (v) => v.name === '__Secure-next-auth.session-token',
    )?.value;
    if (!token) {
      throw new Error('get token failed');
    }
    this.update({ token });
    this.logger.info('update token ok');
  }

  async init(): Promise<void> {
    let page;
    if (this.info.token) {
      page = await CreateNewPage('https://www.phind.com/', {
        cookies: [
          {
            name: '__Secure-next-auth.session-token',
            value: this.info.token,
            domain: 'www.phind.com',
            url: 'https://www.phind.com',
          },
        ],
      });
      this.page = page;
      page = await handleCF(page);
      this.page = page;
      if (await ifCF(page)) {
        await page.browser().close();
        throw new Error('cf failed');
      }
    } else {
      page = await CreateNewPage('https://www.phind.com/api/auth/signin');
      this.page = page;
      page = await handleCF(page);
      this.page = page;
      if (await ifCF(page)) {
        await page.browser().close();
        throw new Error('cf failed');
      }
      await page.waitForSelector(`input[type="email"]`);
      await page.click(`input[type="email"]`);
      const mail = CreateEmail(Config.config.phind.mail_type);
      const email = await mail.getMailAddress();
      await page.keyboard.type(email);
      await page.keyboard.press('Enter');
      let verify;
      for (const v of await mail.waitMails()) {
        verify = v.content.match(/href="([^"]*)/i)?.[1] || '';
        if (verify) {
          break;
        }
      }
      if (!verify) {
        throw new Error('get verify link failed');
      }
      this.update({ email });
      await page.goto(verify);
    }

    if (!(await this.ifLogin())) {
      throw new Error('login failed');
    }
    await this.updateToken();
    await this.updateLeft();
    this.client = new WebFetchWithPage(this.page);
  }

  destroy(options?: DestroyOptions) {
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

export class Phind extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.phind.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.email) {
        return false;
      }
      if (!v.token) {
        return false;
      }
      // 限制当天使用次数,国际时间
      if (!v.left && moment().utc().unix() - v.user_out_time < 24 * 60 * 60) {
        return false;
      }
      return true;
    },
    {
      delay: 3000,
      serial: () => Config.config.phind.serial || 1,
      needDel: (v) => !v.email || !v.token,
      preHandleAllInfos: async (infos) => {
        return infos;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 4000;
      case ModelType.GPT4:
        return 4000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: false,
      countPrompt: false,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    if (req.model === ModelType.GPT4) {
      child.update({ left: child.info.left - 1 });
    }
    try {
      const body = {
        question: req.prompt,
        webResults: [],
        questionHistory: [] as string[],
        answerHistory: [] as string[],
        options: {
          date: '2023/10/23',
          language: 'en-US',
          detailed: true,
          anonUserId: '',
          answerModel: modelMap[req.model],
          creativeMode: true,
          customLinks: [],
        },
        context: '',
      };
      for (const msg of req.messages.slice(0, req.messages.length - 1)) {
        if (msg.role === 'user') {
          body.questionHistory.push(msg.content);
        }
        if (msg.role === 'assistant') {
          body.answerHistory.push(msg.content);
        }
      }
      body.questionHistory.push(req.messages[req.messages.length - 1].content);

      const pt = await child.client.fetch(
        'https://www.phind.com/api/infer/answer',
        {
          headers: {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'sec-ch-ua':
              '" Not;A Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
          },
          referrer: `https://www.phind.com/search?q=${encodeURIComponent(
            req.prompt,
          )}&source=searchbox`,
          referrerPolicy: 'strict-origin-when-cross-origin',
          body: JSON.stringify(body),
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
        },
      );
      pt.pipe(es.split(/\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr.indexOf('<PHIND_METADATA>') > -1) {
            return;
          }
          stream.write(Event.message, {
            content: dataStr,
          });
        }),
      );
      pt.on('close', () => {
        this.logger.info('Recv msg ok');
        stream.write(Event.done, { content: '' });
        stream.end();
        if (child.info.left === 0) {
          child.update({ user_out_time: moment().utc().unix() });
          child.destroy({ delFile: false, delMem: true });
        }
      });
    } catch (e: any) {
      this.logger.error('ask failed, ', e.message);
      stream.write(Event.error, e);
      stream.write(Event.done, { content: '' });
      stream.end();
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
