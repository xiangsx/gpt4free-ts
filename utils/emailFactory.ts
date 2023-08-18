import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { Lock, md5, randomStr, sleep } from './index';
import { CreateAxiosProxy, CreateNewPage } from './proxyAgent';
import { Page } from 'puppeteer';

export enum TempEmailType {
  // need credit card https://rapidapi.com/Privatix/api/temp-mail
  TempEmail = 'temp-email',
  // not need credit card , hard limit 100/day https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44
  TempEmail44 = 'temp-email44',
  // not need credit card and not need credit rapid_api_key
  TempMailLOL = 'tempmail-lol',
  Inbox = 'inbox',
  Internal = 'internal',
  SmailPro = 'smail-pro',
  Gmail = 'gmail',
}

const gmailLock = new Lock();
const smailProLock = new Lock();

export function CreateEmail(
  tempMailType: TempEmailType,
  options?: BaseOptions,
): BaseEmail {
  switch (tempMailType) {
    case TempEmailType.TempEmail44:
      return new TempMail44(options);
    case TempEmailType.TempEmail:
      return new TempMail(options);
    case TempEmailType.TempMailLOL:
      return new TempMailLOL(options);
    case TempEmailType.Inbox:
      return new Inbox(options);
    case TempEmailType.Internal:
      return new Internal(options);
    case TempEmailType.SmailPro:
      return new SmailPro({ ...options, lock: smailProLock });
    case TempEmailType.Gmail:
      return new Gmail({ ...options, lock: gmailLock });
    default:
      throw new Error('not support TempEmailType');
  }
}

export interface BaseMailMessage {
  // main content of email
  content: string;
}

export interface TempMailMessage extends BaseMailMessage {
  _id: {
    oid: string;
  };
  createdAt: {
    milliseconds: number;
  };
  mail_id: string;
  mail_address_id: string;
  mail_from: string;
  mail_subject: string;
  mail_preview: string;
  mail_text_only: string;
  mail_text: string;
  mail_html: string;
  mail_timestamp: number;
  mail_attachments_count: number;
  mail_attachments: {
    attachment: any[];
  };
}

interface BaseOptions {}

abstract class BaseEmail {
  public constructor(options?: BaseOptions) {}

  public abstract getMailAddress(): Promise<string>;

  public abstract waitMails(): Promise<BaseMailMessage[]>;
}

export interface TempMailOptions extends BaseOptions {
  apikey?: string;
}

class Inbox extends BaseEmail {
  private readonly client: AxiosInstance;
  private address: string | undefined;

  constructor(options?: TempMailOptions) {
    super(options);
    const apikey = options?.apikey || process.env.rapid_api_key;
    if (!apikey) {
      throw new Error('Need apikey for TempMail');
    }
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://inboxes-com.p.rapidapi.com',
        headers: {
          'X-RapidAPI-Key': apikey,
          'X-RapidAPI-Host': 'inboxes-com.p.rapidapi.com',
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  public async getMailAddress(): Promise<string> {
    this.address = `${randomStr()}@${await this.randomDomain()}`;
    const res = await this.client.post(`inboxes/${this.address}`);
    console.log(res.data);
    return this.address;
  }

  public async waitMails(): Promise<TempMailMessage[]> {
    return new Promise((resolve) => {
      let time = 0;
      const itl = setInterval(async () => {
        const response = await this.client.get(`inboxes/${this.address}`);
        if (response.data && response.data.length > 0) {
          resolve(
            response.data.map((item: any) => ({
              ...item,
              content: item.mail_html,
            })),
          );
          clearInterval(itl);
          return;
        }
        if (time > 5) {
          resolve([]);
          clearInterval(itl);
          return;
        }
        time++;
      }, 10000);
    });
  }

  async getDomainsList(): Promise<string[]> {
    const res = await this.client.get(`/domains`);
    return res.data.map((item: any) => item.qdn);
  }

  async randomDomain(): Promise<string> {
    const domainList = await this.getDomainsList();
    return domainList[Math.floor(Math.random() * domainList.length)];
  }
}

class TempMail extends BaseEmail {
  private readonly client: AxiosInstance;
  private address: string | undefined;
  private mailID: string = '';

  constructor(options?: TempMailOptions) {
    super(options);
    const apikey = options?.apikey || process.env.rapid_api_key;
    if (!apikey) {
      throw new Error('Need apikey for TempMail');
    }
    this.client = CreateAxiosProxy({
      baseURL: 'https://privatix-temp-mail-v1.p.rapidapi.com/request/',
      headers: {
        'X-RapidAPI-Key': apikey,
        'X-RapidAPI-Host': 'privatix-temp-mail-v1.p.rapidapi.com',
      },
    } as CreateAxiosDefaults);
  }

  public async getMailAddress(): Promise<string> {
    this.address = `${randomStr()}${await this.randomDomain()}`;
    this.mailID = md5(this.address);
    return this.address;
  }

  public async waitMails(): Promise<TempMailMessage[]> {
    const mailID = this.mailID;
    return new Promise((resolve) => {
      let time = 0;
      const itl = setInterval(async () => {
        const response = await this.client.get(`/mail/id/${mailID}`);
        if (response.data && response.data.length > 0) {
          resolve(
            response.data.map((item: any) => ({
              ...item,
              content: item.mail_html,
            })),
          );
          clearInterval(itl);
          return;
        }
        if (time > 5) {
          resolve([]);
          clearInterval(itl);
          return;
        }
        time++;
      }, 10000);
    });
  }

  async getDomainsList(): Promise<string[]> {
    const res = await this.client.get(`/domains/`);
    return res.data;
  }

  async randomDomain(): Promise<string> {
    const domainList = await this.getDomainsList();
    return domainList[Math.floor(Math.random() * domainList.length)];
  }
}

class TempMail44 extends BaseEmail {
  private readonly client: AxiosInstance;
  private address: string = '';

  constructor(options?: TempMailOptions) {
    super(options);
    const apikey = options?.apikey || process.env.rapid_api_key;
    if (!apikey) {
      throw new Error('Need apikey for TempMail');
    }
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://temp-mail44.p.rapidapi.com/api/v3/email/',
        headers: {
          'X-RapidAPI-Key': apikey,
          'X-RapidAPI-Host': 'temp-mail44.p.rapidapi.com',
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  public async getMailAddress(): Promise<string> {
    const response = await this.client.post('/new', {}, {
      headers: {
        'content-type': 'application/json',
      },
    } as AxiosRequestConfig);
    this.address = response.data.email;
    return this.address;
  }

  public async waitMails(): Promise<TempMailMessage[]> {
    return new Promise((resolve) => {
      let time = 0;
      const itl = setInterval(async () => {
        const response = await this.client.get(`/${this.address}/messages`);
        if (response.data && response.data.length > 0) {
          resolve(
            response.data.map((item: any) => ({
              ...item,
              content: item.body_html,
            })),
          );
          clearInterval(itl);
          return;
        }
        if (time > 5) {
          resolve([]);
          clearInterval(itl);
          return;
        }
        time++;
      }, 10000);
    });
  }
}

class TempMailLOL extends BaseEmail {
  private readonly client: AxiosInstance;
  private address: string = '';
  private token: string = '';

  constructor(options?: TempMailOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://api.tempmail.lol',
    } as CreateAxiosDefaults);
  }

  public async getMailAddress(): Promise<string> {
    const response = await this.client.get('/generate');
    this.address = response.data.address;
    this.token = response.data.token;
    return this.address;
  }

  public async waitMails(): Promise<TempMailMessage[]> {
    return new Promise((resolve) => {
      let time = 0;
      const itl = setInterval(async () => {
        const response = await this.client.get(`/auth/${this.token}`);

        if (response.data && response.data.email.length > 0) {
          resolve(
            response.data.email.map((item: any) => ({
              ...item,
              content: item.html,
            })),
          );
          clearInterval(itl);
          return;
        }
        if (time > 5) {
          resolve([]);
          clearInterval(itl);
          return;
        }
        time++;
      }, 10000);
    });
  }
}

class Internal extends BaseEmail {
  private apiUrl: string;
  private client: AxiosInstance;

  constructor(options?: BaseOptions) {
    super(options);
    this.apiUrl = 'https://api.internal.temp-mail.io/api/v3';
    this.client = CreateAxiosProxy({
      baseURL: 'https://api.internal.temp-mail.io/api/v3',
    });
  }

  public async getMailAddress(): Promise<string> {
    const length = Math.floor(Math.random() * (15 - 8 + 1)) + 8;
    const characters =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let address = '';
    for (let i = 0; i < length; i++) {
      address += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    const data = {
      name: address,
      domain: 'gixenmixen.com',
    };
    const response = await this.client.post('/email/new', data);
    const result = response.data;
    console.log(data);
    console.log(result);
    return result.email;
  }

  public async waitMails(): Promise<BaseMailMessage[]> {
    const mailAddress = await this.getMailAddress();
    let times = 0;
    while (true) {
      const response = await this.client.get(`/email/${mailAddress}/messages`);
      console.log(`正在获取邮件：${times}`);
      if (response.status === 200) {
        const data = response.data;
        if (data.length > 0) {
          try {
            const mail = data[0];
            const content = mail.body_html;
            const parser = new DOMParser();
            const htmlDoc = parser.parseFromString(content, 'text/html');
            const codeDiv = htmlDoc.querySelector(
              "div[style='font-family:system-ui, Segoe UI, sans-serif;font-size:19px;font-weight:700;line-height:1.6;text-align:center;color:#333333;']",
            );
            const code = codeDiv?.textContent || '';
            return [{ content: code }];
          } catch (error) {
            console.log('error');
          }
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      times++;
    }
    return [];
  }
}

export class SmailPro extends BaseEmail {
  private page?: Page;
  private lock: Lock;
  constructor(options: GmailOptions) {
    super(options);
    this.lock = options.lock;
  }
  async getMailAddress() {
    await this.lock.lock(120 * 1000);
    if (!this.page) {
      this.page = await CreateNewPage('http://smailpro.com/advanced');
      setTimeout(() => {
        this.page?.browser().close();
      }, 360 * 1000);
    }
    try {
      const page = this.page;
      await page.waitForSelector(
        '.grid > .md\\:rounded-md > .absolute:nth-child(2) > .w-6 > path',
      );
      await page.click(
        '.grid > .md\\:rounded-md > .absolute:nth-child(2) > .w-6 > path',
      );

      await page.waitForSelector(
        '.relative > .absolute > .text-gray-500 > .h-6 > path',
      );
      await page.click('.relative > .absolute > .text-gray-500 > .h-6 > path');
      await sleep(1000);
      await page.waitForSelector('#autosuggest__input', { visible: true });
      await page.click('#autosuggest__input');
      await page.keyboard.type('random@gmail.com', {
        delay: 40,
      });
      await sleep(1000);
      await page.keyboard.press('Enter');
      console.log('generating email');
      let times = 0;
      while (true) {
        times += 1;
        await page.waitForSelector('#my-email');
        const email = await page.evaluate(
          () => document.querySelector('#my-email')?.textContent || '',
        );
        if (email === '...') {
          if (times > 5) {
            throw new Error('get mail failed, max retry times!');
          }
          await sleep(5 * 1000);
          continue;
        }
        return email + '@gmail.com';
      }
    } catch (e) {
      console.log('get mail failed, err:', e);
      this.page.browser?.().close();
      this.lock.unlock();
      throw e;
    }
  }

  async waitMails(): Promise<BaseMailMessage[]> {
    const page = this.page;
    if (!page) {
      return [];
    }
    let times = 0;
    while (true) {
      try {
        await page.waitForSelector(
          '.flex-auto > .flex > .inline-flex > .order-last > .h-6',
          { timeout: 5 * 1000 },
        );
        await page.click(
          '.flex-auto > .flex > .inline-flex > .order-last > .h-6',
        );

        await page.waitForSelector(
          '.flex-auto > .flex > .py-2 > .scrollbar > .px-2',
          { timeout: 5 * 1000 },
        );
        await page.click('.flex-auto > .flex > .py-2 > .scrollbar > .px-2');

        await page.waitForSelector('.flex > div > div > .mt-2 > .w-full', {
          timeout: 5 * 1000,
        });
        // 获取 srcdoc 属性
        const content = await page.evaluate(() => {
          return (
            //@ts-ignore
            // prettier-ignore
            document.querySelector('.flex > div > div > .mt-2 > .w-full')?.contentDocument.documentElement.outerHTML || ''
          );
        });
        if (content) {
          await this.page?.browser().close();
          this.lock.unlock();
          return [{ content }];
        }
        await sleep(5 * 1000);
      } catch (e: any) {
        if (times >= 6) {
          this.lock.unlock();
          await this.page?.browser().close();
          throw new Error('got mails failed');
        }
      } finally {
        times += 1;
      }
    }

    return [];
  }
}

export interface GmailOptions extends BaseOptions {
  lock: Lock;
}

class Gmail extends BaseEmail {
  private readonly client: AxiosInstance;
  private address: string = '';
  private timestamp?: number = 0;
  private lock: Lock;

  constructor(options: GmailOptions) {
    super(options);
    const apikey = process.env.rapid_api_key || '';
    this.lock = options.lock;
    if (!apikey) {
      throw new Error('Need apikey for TempMail');
    }
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://temp-gmail.p.rapidapi.com',
        headers: {
          'X-RapidAPI-Key': apikey,
          'X-RapidAPI-Host': 'temp-gmail.p.rapidapi.com',
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  public async getMailAddress(): Promise<string> {
    await this.lock.lock(60 * 1000);
    const response: any = await this.client.get('/get', {
      params: {
        domain: 'googlemail.com',
        username: 'random',
        server: 'server-2',
        type: 'real',
      },
    } as AxiosRequestConfig);
    this.address = response.data.items.email;
    this.timestamp = response.data.items.timestamp;
    return this.address;
  }

  public async check(): Promise<[boolean, string]> {
    try {
      const checkres = await this.client.get(`/check`, {
        params: {
          email: this.address,
          timestamp: `${this.timestamp}`,
        },
      });
      const mid = checkres.data.items[0]?.mid;
      return [checkres.data.msg === 'ok', mid || ''];
    } catch (e: any) {
      console.log('check email failed, err = ', e.message);
      return [false, ''];
    }
  }

  public async waitMails(): Promise<TempMailMessage[]> {
    return new Promise((resolve) => {
      let time = 0;
      const itl = setInterval(async () => {
        try {
          const [ok, mid] = await this.check();
          if (!mid) {
            return;
          }
          const response = await this.client.get(`/read`, {
            params: { email: this.address, message_id: mid },
          });
          if (response.data && response.data.items) {
            const item = response.data.items;
            resolve([{ ...item, content: item.body }]);
            this.lock.unlock();
            clearInterval(itl);
            return;
          }
          if (time > 5) {
            resolve([]);
            this.lock.unlock();
            clearInterval(itl);
            return;
          }
        } catch (e: any) {
          console.error(e.message);
        }

        time++;
      }, 20 * 1000);
    });
  }
}
