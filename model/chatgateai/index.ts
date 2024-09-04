import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  parseJSON,
  randomNonce,
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
import { CreateEmail, TempEmailType } from '../../utils/emailFactory';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import es from 'event-stream';
// @ts-ignore
import { Session } from 'tls-client/dist/esm/sessions';
import { randomInt } from 'crypto';

const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT4]: 'chatbot-tydbjd',
  [ModelType.Claude3Opus]: 'chatbot-zdmvyq',
};

interface Account extends ComInfo {
  use_out_time: number;
  email: string;
  cookies: string;
  XWPNonce: string;
}

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: '',
      },
      false,
    );
  }

  async init(): Promise<void> {
    try {
      if (this.info.cookies) {
        this.logger.info('cookies found');
      } else {
        let page;
        page = await CreateNewPage(
          'https://chatgate.ai/login?redirect_to=https%3A%2F%2Fchatgate.ai%2F',
          { simplify: false },
        );
        this.page = page;
        await page.waitForSelector(
          '#firebaseui-auth-container > div > div.firebaseui-card-content > form > ul > li:nth-child(3) > button',
        );
        await page.click(
          '#firebaseui-auth-container > div > div.firebaseui-card-content > form > ul > li:nth-child(3) > button',
        );
        const mailbox = CreateEmail(
          Config.config.chatgateai?.mail_type || TempEmailType.TempMailLOL,
        );
        const email = await mailbox.getMailAddress();
        this.update({
          email: email,
        });
        await page.waitForSelector('input[type="email"]');
        await page.click('input[type="email"]');
        await page.keyboard.type(email);
        await page.keyboard.press('Enter');
        for (const v of await mailbox.waitMails()) {
          let verifyUrl = v.content.match(/href=["'](.*?)["']/i)?.[1] || '';
          if (!verifyUrl) {
            throw new Error('verifyUrl not found');
          }
          verifyUrl = verifyUrl.replace(/&amp;/g, '&');
          await page.goto(verifyUrl, {
            waitUntil: 'networkidle2',
            timeout: 60 * 10000,
          });
        }
        await sleep(10 * 6 * 1000);
        await page.goto('https://chatgate.ai/gpt4/');
        await sleep(5 * 1000);
        const req = await page.waitForRequest(
          (req) =>
            req
              .url()
              .indexOf(
                'https://chatgate.ai/wp-json/mwai-ui/v1/discussions/list',
              ) > -1,
        );
        this.logger.info(`req: ${req.url()}`);
        const headers = req.headers();
        this.logger.info(`headers: ${JSON.stringify(headers)}`);
        const XWPNonce = headers['x-wp-nonce'];
        const cookies = (await page.cookies('https://chatgate.ai'))
          .map((v) => `${v.name}=${v.value}`)
          .join('; ');
        this.logger.info(`XWPNonce: ${XWPNonce}`);
        this.update({
          XWPNonce: XWPNonce,
          cookies,
        });
      }
    } catch (e) {
      this.logger.error('init failed, ', e);
      this.destroy({ delFile: false, delMem: true });
      this.page?.browser().close();
    }
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

export class Chatgateai extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.chatgateai?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.cookies) {
        return false;
      }
      const resetTime = moment().utc().startOf('day').unix();
      if (v.use_out_time > resetTime) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.chatgateai?.serial || 1,
      needDel: (v) => !v.cookies,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 1000;
      case ModelType.Claude3Opus:
        return 10000000;
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
    return reqH;
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    try {
      const url = 'https://chatgate.ai/wp-json/mwai-ui/v1/chats/submit';
      const headers = {
        'Content-Type': 'application/json',
        authority: 'chatgate.ai',
        origin: 'https://chatgate.ai',
        referer: 'https://chatgate.ai/gpt4/',
        pragma: 'no-cache',
        'X-WP-Nonce': child.info.XWPNonce,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
        Cookie: child.info.cookies,
      };
      const data = {
        botId: ModelMap[req.model],
        customId: null,
        session: randomStr(12),
        chatId: randomStr(12),
        contextId: randomInt(10000, 99999),
        messages: [
          {
            id: 'z4neetx1pl9',
            role: 'assistant',
            content: "Hi! I'm Claude-3 Opus. How can I assist you today?",
            who: 'AI: ',
            timestamp: Date.now() - 1000,
          },
        ],
        newMessage: req.prompt,
        newFileId: null,
        stream: true,
      };
      const res = await child.client.post(url, data, {
        headers: headers,
        responseType: 'stream',
      });
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map((chunk: any) => {
          try {
            const data = chunk.toString().replace('data: ', '');
            console.log(data);
            if (data.includes('Reached your daily limit')) {
              throw new Error('Reached your daily limit');
            }
            if (data.includes('rejected')) {
              throw new Error('rejected');
            }
            if (!data) {
              return;
            }
            const v = JSON.parse(data);
            if (v.data) {
              if (v.type === 'live') {
                stream.write(Event.message, { content: v.data });
              }
              if (v.type === 'error') {
                stream.write(Event.error, { error: v.data, status: 500 });
              }
            }
          } catch (e: any) {
            this.logger.error('parse data failed, ', e);
            stream.write(Event.error, {
              error: 'Something error, please retry later',
              status: 500,
            });
          }
        }),
      );

      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      stream.write(Event.error, {
        error: 'Something error, please retry later',
        status: 500,
      });
      if (e.message === 'Reached your daily limit') {
        child.update({
          use_out_time: moment().utc().endOf('day').unix(),
        });
      } else if (e.message === 'rejected') {
        // Add your statement or declaration here
      } else {
        child.update({
          cookies: '',
        });
      }
      stream.write(Event.done, { content: '' });
      stream.end();
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
