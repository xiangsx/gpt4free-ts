import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, parseJSON, randomStr, sleep } from '../../utils';
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
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import { handleCF, ifCF } from '../../utils/captcha';
import { CreateEmail } from '../../utils/emailFactory';
import { ApiKeyBase, ApiKeysData } from './define';
import { AxiosRequestConfig } from 'axios/index';
import es from 'event-stream';

type Room = {
  rid: string;
  sid: string;
};

interface Account extends ComInfo {
  username: string;
  email: string;
  password: string;
  apikey: string;
}

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateNewAxios(
      {
        baseURL: 'https://api.freegpt4.tech/',
      },
      { proxy: true },
    );
  }

  async createAPIKey(info: ApiKeyBase) {
    return this.page?.evaluate((info) => {
      return new Promise((resolve, reject) => {
        fetch('https://freegpt4.tech/OneAI/API/User/APIKeys.php', {
          headers: {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
          },
          referrer: 'https://freegpt4.tech/panel/',
          referrerPolicy: 'strict-origin-when-cross-origin',
          body: JSON.stringify(info),
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
        })
          .then((res) => {
            res.text().then(resolve).catch(reject);
          })
          .catch(reject);
      });
    }, info);
  }

  async getAPIKey(): Promise<ApiKeysData> {
    return (await this.page?.evaluate(() => {
      return new Promise((resolve, reject) => {
        fetch('https://freegpt4.tech/OneAI/API/User/APIKeys.php', {
          headers: {
            accept: '*/*',
            'accept-language': 'en-US,en;q=0.9',
          },
          referrer: 'https://freegpt4.tech/panel/',
          referrerPolicy: 'strict-origin-when-cross-origin',
          body: null,
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
        })
          .then((res) => {
            res.json().then(resolve).catch(reject);
          })
          .catch(reject);
      });
    })) as ApiKeysData;
  }

  async initAPIKey() {
    const res = await this.createAPIKey({
      name: randomStr(12 + Math.floor(Math.random() * 10)),
      quota: 99999999 + Math.floor(Math.random() * 9999),
      models: [
        'gpt-4-rp',
        'gpt-3.5-rp',
        'claude-rp',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-0301',
        'gpt-3.5-turbo-1106',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-0314',
        'gpt-4-32k',
        'gpt-4-1106-preview',
        'llama-2-7b',
        'llama-2-13b',
        'llama-2-70b',
        'code-llama-34b',
        'gemini-pro',
        'palm-2',
        'palm-2-32k',
        'code-palm-2',
        'code-palm-2-32k',
        'claude-instant',
        'claude-instant-1',
        'claude-1-100k',
        'claude-2',
        'claude-2.1',
        'claude-1.2',
        'yi-34b',
        'falcon-180b',
        'goliath-120b',
        'sdxl',
        'sdxl-emoji',
        'stable-diffusion-2.1',
        'stable-diffusion-1.5',
        'clip-interrogator-2',
        'whisper-3',
        'dall-e-2',
        'dall-e-3',
        'midjourney',
        'deliberate',
        'dreamshaper',
        'anything-diffusion',
      ],
    });
    console.log(res);
    await sleep(5000);
    const apikey = await this.getAPIKey();
    if (!apikey.apiKeys?.length) {
      throw new Error('no apikey');
    }
    this.update({ apikey: apikey.apiKeys[0].key });
    this.logger.info(`init apikey ok: ${apikey.apiKeys[0].key}`);
  }

  async init(): Promise<void> {
    if (this.info.apikey) {
      return;
    }
    let page: Page;
    if (this.info.email && this.info.password) {
      page = await CreateNewPage('https://freegpt4.tech/login.html');
      this.page = page;
    } else {
      page = await CreateNewPage('https://freegpt4.tech/register.html', {
        recognize: false,
      });
      if (await ifCF(page)) {
        await sleep(5000);
        page = await handleCF(page);
      }
      const cfok = await ifCF(page);
      if (cfok) {
        throw new Error('cf error');
      }
      this.page = page;
      await page.waitForSelector('#usernameInput');
      const username = randomStr(5 + Math.floor(Math.random() * 10));
      await page.click('#usernameInput');
      await page.keyboard.type(username);

      const mail = CreateEmail(Config.config.freegpt4.mail_type);
      const email = await mail.getMailAddress();
      await page.waitForSelector('#emailInput');
      await page.click('#emailInput');
      await page.keyboard.type(email);

      const password = randomStr(10 + Math.floor(Math.random() * 10));
      await page.waitForSelector('#passwordInput');
      await page.click('#passwordInput');
      await page.keyboard.type(password);

      await page.waitForSelector('#password2Input');
      await page.click('#password2Input');
      await page.keyboard.type(password);
      await page.click('#registerButton');
      let link: string | undefined = '';
      for (const v of await mail.waitMails()) {
        link = v.content.match(/href="([^"]*)/i)?.[1];
        if (link) {
          break;
        }
      }
      if (!link) {
        throw new Error('no link');
      }
      await page.goto(link);
      this.update({ email, password, username });
    }

    await page.waitForSelector('#emailInput');
    await page.click('#emailInput');
    await page.keyboard.type(this.info.email);

    await page.waitForSelector('#passwordInput');
    await page.click('#passwordInput');
    await page.keyboard.type(this.info.password);

    await page.waitForSelector('#loginButton');
    await page.click('#loginButton');
    await page.waitForSelector('.navbar-toggler-icon');
    await this.initAPIKey();
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: false, delMem: true });
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

export class FreeGPT4 extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.freegpt4.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.email || !v.password) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: () => Config.config.freegpt4.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 12000;
      case ModelType.GPT3p5Turbo:
        return 3000;
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
    try {
      const res = await child.client.post(
        '/v1/chat/completions',
        {
          messages: req.messages,
          model: req.model,
          stream: true,
        },
        {
          responseType: 'stream',
          headers: {
            Authorization: `Bearer ${child.info.apikey}`,
            'Content-Type': 'application/json',
          },
        } as AxiosRequestConfig,
      );
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
      e.response?.data?.on('data', (chunk: any) =>
        this.logger.error(chunk.toString()),
      );
      stream.write(Event.error, { error: e.message });
      stream.end();
      child.destroy({ delMem: true, delFile: false });
    }
  }
}
