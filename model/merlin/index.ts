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
import { CreateAxiosProxy, CreateNewPage } from '../../utils/proxyAgent';
import { CreateEmail, TempEmailType } from '../../utils/emailFactory';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';
import es from 'event-stream';

const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT4]: 'GPT 4',
  [ModelType.GPT3p5Turbo]: 'GPT 3',
  [ModelType.Claude3Opus20240229]: 'claude-3-opus',
  [ModelType.Claude3Opus]: 'claude-3-opus',
  [ModelType.Claude3Haiku]: 'claude-3-haiku',
  [ModelType.Claude3Haiku20240307]: 'claude-3-haiku',
  [ModelType.Claude3Haiku200k]: 'claude-3-haiku',
};

interface Account extends ComInfo {
  username: string;
  email: string;
  password: string;
  left: number;
  useOutTime: number;
  accessToken: string;
  tokenGotTime: number;
}

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://uam.getmerlin.in',
      },
      false,
    );
  }

  async init(): Promise<void> {
    let page;
    if (this.info.accessToken) {
      this.logger.info('login with token ...');
      page = await CreateNewPage('https://app.getmerlin.in/login', {
        recognize: true,
      });
      this.page = page;
      await page.setUserAgent(randomUserAgent());
      await page.waitForSelector('#email');
      await page.click('#email');
      await page.keyboard.type(this.info.email);

      await page.waitForSelector('#password');
      await page.click('#password');
      await page.keyboard.type(this.info.password);
      await page.keyboard.press('Enter');
    } else {
      this.logger.info('register new account ...');
      page = await CreateNewPage('https://app.getmerlin.in/register');
      this.page = page;
      await page.waitForSelector('#name');
      await page.click('#name');
      let username = randomStr(10).replace(/\d/g, '');
      await page.keyboard.type(username);
      this.update({ username });

      const mailbox = CreateEmail(
        Config.config.merlin?.mail_type || TempEmailType.TempEmail44,
      );
      const email = await mailbox.getMailAddress();
      await page.waitForSelector('#email');
      await page.click('#email');
      await page.keyboard.type(email);
      this.update({ email });

      await page.waitForSelector('#password');
      await page.click('#password');
      const password = randomStr(20);
      await page.keyboard.type(password);
      this.update({ password });

      await page.waitForSelector('button[type="submit"]');
      await page.click('button[type="submit"]');
      await sleep(10000);

      const resendbutton = 'div > main > div > div > div > div > button';
      await page.waitForSelector(resendbutton);
      await page.click(resendbutton);
      await sleep(5000);

      for (const v of await mailbox.waitMails()) {
        let verifyUrl = v.content.match(/href=["'](.*?)["']/i)?.[1] || '';
        if (!verifyUrl) {
          throw new Error('verifyUrl not found');
        }
        verifyUrl = verifyUrl.replace(/&amp;/g, '&');
        const vPage = await page.browser().newPage();
        await vPage.goto(verifyUrl);
      }
    }

    await sleep(3000);
    await page.bringToFront();
    await page.reload();
    await sleep(2000);
    this.logger.info('get loginToken ...');
    const loginStatus = await this.getLoginStatus(page);
    if (!loginStatus || !loginStatus.token) {
      throw new Error('get login status failed');
    }
    if (!loginStatus.left || loginStatus.left < 10) {
      this.update({ left: loginStatus.left || 0 });
      throw new Error(`left size:${loginStatus.left} < 10`);
    }
    await sleep(2000);
    this.logger.info('get session ...');
    await this.getSession(loginStatus.token);
    this.update({
      left: loginStatus.left,
      tokenGotTime: moment().unix(),
    });
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
  }

  initFailed(e?: Error) {
    this.update({ left: 0, useOutTime: moment().unix() });
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
    this.destroy({ delFile: !this.info.email, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
  }

  async genSignImage(contentType: string[] = [], numOfImages: number = 1) {
    fetch(
      'https://uam.getmerlin.in/user/generateSignedUrlImages?&customJWT=true',
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXRhaWxzIjp7Im5hbWUiOiJhc2FieGtoNzQxODMwNDggbHpnZmU5NDgxIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0pieXcwNEZDTmdWY29fclZZZng4VWJEX3l2RUhDSzBRcjZaUXhTaW9hTU9OSml6QT1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9mb3llci13b3JrIiwiYXVkIjoiZm95ZXItd29yayIsImF1dGhfdGltZSI6MTcxMjc0ODIzNywidXNlcl9pZCI6ImF2RjBVV0lQejBaTVhEd3UzcUhGaVhDN1ZvUzIiLCJzdWIiOiJhdkYwVVdJUHowWk1YRHd1M3FIRmlYQzdWb1MyIiwiaWF0IjoxNzEyNzQ4MjM3LCJleHAiOjE3MTI3NTE4MzcsImVtYWlsIjoienkxMTA0MTk5MTkzMEBia2xlLnVrIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDYyMjU3MjM5MDYzMzMyNDc2MjkiXSwiZW1haWwiOlsienkxMTA0MTk5MTkzMEBia2xlLnVrIl19LCJzaWduX2luX3Byb3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9LCJ1aWQiOiJhdkYwVVdJUHowWk1YRHd1M3FIRmlYQzdWb1MyIn0sImlhdCI6MTcxMjc0ODI0MCwiZXhwIjoxNzE3OTMyMjQwfQ.FTuvvtm1g9a1hioddkx3fv6sPoORvNP71s2lAqG2KQM',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          pragma: 'no-cache',
          'sec-ch-ua':
            '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'x-merlin-version': 'extension-null',
          Referer: 'https://www.getmerlin.in/',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: '{"contentType":["image/jpeg"],"numOfImages":1}',
        method: 'POST',
      },
    );
    this.client.post('/user/generateSignedUrlImages?&customJWT=true', {
      contentType,
      numOfImages,
    });
  }

  async getLoginStatus(page: Page) {
    try {
      page.goto('https://www.getmerlin.in/zh-CN/chat');
      const req = await page.waitForResponse(
        (req) =>
          req.url().indexOf('getAstroProfiles') > -1 &&
          req.request().method().toUpperCase() === 'GET',
      );

      function removeRepeats(num: number): number {
        const str = num.toString();
        const len = str.length;

        if (len % 2 !== 0 || len === 1) {
          return num;
        }

        const mid = len / 2;
        const part1 = str.slice(0, mid);
        const part2 = str.slice(mid);

        if (part1 === part2) {
          return parseInt(part1, 10);
        }

        return num;
      }

      const token = req.url().split('token=')[1].split('&')[0];
      this.logger.info(`get login status token: ${token}`);
      const element = await page.$('span.text-cornblue-700');
      const textContent = await page.evaluate((el) => el?.textContent, element);
      const match = textContent?.match(/(\d+)\s*queries\s*left/);
      let left = 0;
      if (match) {
        left = Number(match[1]);
        left = removeRepeats(left);
      }
      this.logger.info(`get login status left: ${left}`);
      return { token, left: left };
    } catch (e) {
      this.logger.error('getLoginStatus failed, ', e);
      return undefined;
    }
  }

  async getUsage(page: Page) {
    try {
      page.reload();
      const req = await page.waitForRequest(
        (req) => req.url().indexOf('status') > -1,
      );
      const url = new URLSearchParams(req.url().split('?')[1]);
      return url.get('firebaseToken');
    } catch (e) {
      return undefined;
    }
  }

  async getSession(token: string) {
    this.update({
      accessToken: token,
    });
    return token;
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class Merlin extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.merlin?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.accessToken) {
        return false;
      }
      if (!v.left && !v.useOutTime) {
        return false;
      }
      if (v.left < 10 && moment().unix() - v.useOutTime < 24 * 60 * 60) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.merlin?.serial || 1,
      needDel: (v) => !v.email,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5800;
      case ModelType.GPT3p5Turbo:
        return 2500;
      case ModelType.Claude3Opus20240229:
        return 20000;
      case ModelType.Claude3Opus:
        return 20000;
      case ModelType.Claude3Haiku:
        return 20000;
      case ModelType.Claude3Haiku200k:
        return 20000;
      case ModelType.Claude3Haiku20240307:
        return 20000;
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
    if (reqH.model.indexOf('claude') > -1) {
      reqH.prompt = reqH.prompt
        .replace(/user:/g, 'Human:')
        .replace(/assistant/g, 'Assistant:');
    }
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
      const res = await child.client.post(
        '/thread/unified?customJWT=true&version=1.1',
        {
          action: {
            message: {
              attachments: [],
              content: req.prompt,
              metadata: {
                context: '',
              },
              parentId: 'root',
              role: 'user',
            },
            type: 'NEW',
          },
          activeThreadSnippet: [],
          chatId: v4(),
          language: 'AUTO',
          metadata: null,
          mode: 'VANILLA_CHAT',
          model: ModelMap[req.model],
          personaConfig: {},
        },
        {
          headers: {
            Authorization: `Bearer ${child.info.accessToken}`,
          },
          responseType: 'stream',
        },
      );
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map((chunk: any) => {
          try {
            const data = chunk.toString().replace('event: message\ndata: ', '');
            if (!data) {
              return;
            }
            const v = parseJSON<{
              data: {
                content: string;
                eventType: string;
                usage?: { used: number; limit: number };
              };
            }>(data, {} as any);
            switch (v.data.eventType) {
              case 'CHUNK':
                stream.write(Event.message, { content: v.data.content });
                return;
              case 'SYSTEM':
                if (!v.data.usage) {
                  return;
                }
                child.update({
                  left: v.data.usage?.limit - v.data.usage?.used,
                });
                return;
              case 'DONE':
                return;
              default:
                return;
            }
          } catch (e) {
            this.logger.error('parse data failed, ', e);
          }
        }),
      );
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
        if (child.info.left < 10) {
          child.update({ useOutTime: moment().unix() });
          child.destroy({ delFile: false, delMem: true });
        }
      });
    } catch (e: any) {
      this.logger.error('ask failed, ', e);
      child.update({
        left: child.info.left - 10,
        useOutTime: moment().unix(),
      });
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
