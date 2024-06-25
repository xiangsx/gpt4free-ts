import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { getRandomOne, Lock, md5, randomStr, sleep } from './index';
import { CreateAxiosProxy, CreateNewPage } from './proxyAgent';
import { Page } from 'puppeteer';
import Mailjs from '@cemalgnlts/mailjs';
// @ts-ignore
import * as cheerio from 'cheerio';

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
  SmailProGmail = 'smail-pro-gmail',
  SmailProGoogleMail = 'smail-pro-googlemail',
  SmailProOutlook = 'smail-pro-outlook',
  SmailProRandom = 'smail-pro-random',
  SmailProStoreGmail = 'smail-pro-storegmail',
  Gmail = 'gmail',
  EmailNator = 'emailnator',
  MailTM = 'mailtm',
  YopMail = 'yopmail',
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
      return new SmailPro({
        ...options,
        lock: smailProLock,
        mail: 'gmail.com',
      });
    case TempEmailType.SmailProGmail:
      return new SmailPro({
        ...options,
        lock: smailProLock,
        mail: 'gmail.com',
      });
    case TempEmailType.SmailProGoogleMail:
      return new SmailPro({
        ...options,
        lock: smailProLock,
        mail: 'googlemail.com',
      });
    case TempEmailType.SmailProOutlook:
      return new SmailPro({
        ...options,
        lock: smailProLock,
        mail: 'outlook.com',
      });
    case TempEmailType.SmailProRandom:
      return new SmailPro({
        ...options,
        lock: smailProLock,
        mail: 'random',
      });
    case TempEmailType.SmailProStoreGmail:
      return new SmailPro({
        ...options,
        lock: smailProLock,
        mail: 'storegmail.net',
      });
    case TempEmailType.Gmail:
      return new Gmail({ ...options, lock: gmailLock });
    case TempEmailType.EmailNator:
      return new EmailNator(options);
    case TempEmailType.MailTM:
      return new MailTM();
    case TempEmailType.YopMail:
      return new YopMail();
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
        try {
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
        } catch (e: any) {
          console.error('tempmail lol error', e.message);
        }
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
  private page!: Page;
  private mail: string;

  constructor(options: SmailProOptions) {
    super(options);
    this.mail = options.mail || 'gmail';
  }

  async getMailAddress() {
    try {
      if (!this.page) {
        this.page = await CreateNewPage('http://smailpro.com/advanced', {
          simplify: true,
        });
        setTimeout(() => {
          this.page
            ?.browser()
            .close()
            .catch((e) => console.error(e.message));
        }, 360 * 1000);
      }
      const page = this.page;
      await sleep(5000);
      await page.waitForSelector(
        'div > div> div:nth-child(2) > button:nth-child(1)',
      );
      await page.click('div > div> div:nth-child(2) > button:nth-child(1)');

      await sleep(1000);
      await page.waitForSelector('#autosuggest__input', { visible: true });
      await page.click('#autosuggest__input');
      await page.keyboard.type(`random@${this.mail}`);
      await page.keyboard.press('Enter');
      console.log('generating email');
      await sleep(5000);
      let times = 0;
      while (true) {
        times += 1;
        await page.waitForSelector('address');
        const address = await page.evaluate(() =>
          // @ts-ignore
          document.querySelector('address').textContent.trim(),
        );
        if (address.indexOf('@') === -1) {
          if (times > 5) {
            throw new Error('get mail failed, max retry times!');
          }
          await sleep(5 * 1000);
          continue;
        }
        return address;
      }
    } catch (e) {
      console.log('get mail failed, err:', e);
      await this.page?.screenshot({
        path: `./run/smailpro_${randomStr(10)}.png`,
      });
      this.page?.browser?.().close();
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
          return [{ content }];
        }
        await sleep(10 * 1000);
      } catch (e: any) {
        if (times >= 6) {
          await this.page?.screenshot({
            path: `./run/smailpro_${randomStr(10)}.png`,
          });
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

export interface SmailProOptions extends GmailOptions {
  lock: Lock;
  mail: string;
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

export class EmailNator extends BaseEmail {
  page!: Page;
  private clear?: NodeJS.Timeout;
  private email?: string;

  constructor(options?: BaseOptions) {
    super(options);
  }

  async getMailAddress(): Promise<string> {
    try {
      if (!this.page) {
        this.page = await CreateNewPage('https://emailnator.com/');
        await this.page.waitForSelector('#custom-switch-domain');
        await this.page.click('#custom-switch-domain');
        await this.page.waitForSelector(
          '.mb-3 > .card-body > .justify-content-md-center > .mx-auto > .btn-lg',
        );
        await this.page.click(
          '.mb-3 > .card-body > .justify-content-md-center > .mx-auto > .btn-lg',
        );
        this.clear = setTimeout(() => {
          this.page.browser().close();
        }, 360 * 1000);
      }
      await this.page.waitForSelector(
        '.col-lg-7 > .mb-3 > .card-body > .mb-3 > .form-control-lg',
      );
      const emailInput = await this.page.$(
        '.col-lg-7 > .mb-3 > .card-body > .mb-3 > .form-control-lg',
      );
      await sleep(5000);
      // @ts-ignore
      const email = await emailInput.evaluate((el) => el.value);
      // await sleep(10 * 60 * 1000);
      if (!email) {
        throw new Error('get email failed');
      }
      this.email = email;

      await sleep(3000);
      await this.page.waitForSelector(
        '.col-lg-7 > .mb-3 > .card-body > .text-center > .btn-lg',
      );
      await this.page.click(
        '.col-lg-7 > .mb-3 > .card-body > .text-center > .btn-lg',
      );
      return email;
    } catch (e) {
      throw e;
    }
  }

  private async getMails() {
    try {
      await this.page.waitForSelector(
        '.card > .card-body > .mb-3 > .col-md-6 > .float-md-end',
      );
      setImmediate(() => {
        this.page.click(
          '.card > .card-body > .mb-3 > .col-md-6 > .float-md-end',
        );
      });
      const res = await this.page.waitForResponse(
        (res) =>
          res.url() === 'https://www.emailnator.com/message-list' &&
          res.headers()['content-type'].indexOf('application/json') > -1,
      );
      let mails: any[] = (await res.json()).messageData;
      mails = mails.filter((v) => v.messageID !== 'ADSVPN');
      return mails || [];
    } catch (e: any) {
      console.log('get mails failed, err = ', e.message);
      return [];
    }
  }

  async getMailDetail(mail: string, messageID: string) {
    try {
      this.page
        .goto(`https://www.emailnator.com/inbox/${mail}/${messageID}`)
        .catch(console.error);
      const res = await this.page.waitForResponse(
        (res) => res.url() === 'https://www.emailnator.com/message-list',
      );
      return await res.text();
    } catch (e) {
      throw e;
    }
  }

  async waitMails(): Promise<BaseMailMessage[]> {
    let tryTimes = 0;

    return new Promise(async (resolve, reject) => {
      try {
        for (let i = 0; i < 3; i++) {
          const mails = await this.getMails();
          const v = mails.find(
            (v) =>
              v.time.indexOf('Just Now') > -1 ||
              v.time.indexOf('one minute ago') > -1,
          );
          if (!v) {
            if (tryTimes >= 3) {
              reject(new Error('get mail failed'));
              await this.page.browser().close();
              return;
            }
            await sleep(5000);
            continue;
          }
          const content =
            (await this.getMailDetail(this.email || '', v.messageID)) || '';
          resolve([{ content } as BaseMailMessage]);
          setTimeout(() => this.page.browser().close(), 5000);
          return;
        }
        reject(new Error('get mail failed'));
      } catch (e) {
        reject(e);
      }
    });
  }
}

export class MailTM extends BaseEmail {
  private readonly mailjs: Mailjs;
  private password?: string;
  private account?: string;

  constructor() {
    super();
    this.mailjs = new Mailjs();
  }

  async getMailAddress(): Promise<string> {
    const account = await this.mailjs.createOneAccount();

    this.mailjs.on('ready', () => console.log('Ready To Listen!'));
    // @ts-ignore
    return account.data.username;
  }

  async waitMails(): Promise<BaseMailMessage[]> {
    for (let i = 0; i < 3; i++) {
      const messages = await this.mailjs.getMessages(1);
      if (messages.data.length === 0) {
        await sleep(3000);
        continue;
      }
      const one = messages.data[0];
      const message = await this.mailjs.getMessage(one.id);
      return [{ content: message.data.html.join('\n') }];
    }
    return [];
  }
}

export class YopMail extends BaseEmail {
  client = CreateAxiosProxy({ baseURL: 'https://yopmail.com/' }, false, true);
  private realMail!: string;
  private randomMail!: string;
  private mailName!: string;

  async getMailAddress(): Promise<string> {
    this.realMail = await this.getMail();
    this.mailName = this.realMail.split('@')[0];
    const mailSfx = getRandomOne(await this.getMailSuffix());
    this.randomMail = this.realMail.replace('yopmail.com', mailSfx);
    return this.randomMail;
  }

  async waitMails(): Promise<BaseMailMessage[]> {
    let msgs: BaseMailMessage[] = [];
    for (let i = 0; i <= 3; i++) {
      const inbox: { inbox: { id: string; subject: string }[] } =
        await this.getInbox(this.realMail);
      inbox.inbox = inbox.inbox.filter(
        (v) => v.subject.indexOf('Progress report') === -1,
      );
      if (inbox.inbox.length === 0) {
        await sleep(10 * 1000);
        continue;
      }
      for (const v of inbox.inbox) {
        const msg: { data: string } = await this.readMessage(
          this.mailName,
          v.id,
          'html',
        );
        msgs.push({ content: msg.data });
      }
      return msgs;
    }
    throw new Error('wait mail failed');
  }

  async getMailSuffix(): Promise<string[]> {
    const res = await this.client.get('/zh/domain?d=list');
    const regex = /<option>@(.+?)<\/option>/g;
    return [...res.data.matchAll(regex)]
      .map((m) => m[1])
      .filter((v) => typeof v === 'string')
      .filter((v: string) => v.toLowerCase().indexOf('yopmail') === -1);
  }

  async getMail() {
    const response = await this.client.get('/es/email-generator');
    const $ = cheerio.load(response.data);
    const genEmail = $('#geny').text();
    return genEmail.split(';')[1] || genEmail;
  }

  async getInbox(
    mailAddress: string,
    search: any = {},
    settings: any = {},
  ): Promise<any> {
    const mail = (mailAddress.split('@')[0] || '').toLowerCase() || mailAddress;
    const { cookie: cookie, yp: yp } = await this.getCookiesAndYP();
    const yj = await this.getYJ(cookie);
    return await this.detailInbox(mail, yp, yj, cookie, search, settings);
  }

  async getCookiesAndYP() {
    const response = await this.client.get('/');
    const $ = cheerio.load(response.data);
    const yp = $('input#yp').val();
    const cookie = response.headers['set-cookie']
      ?.map((x) => x.split(';')[0])
      .join('; ');
    if (!cookie) {
      throw new Error('cookie is null');
    }
    const location = response.data.match(/lang=\"(.*?)\"/)[1];
    return { cookie: cookie, yp: yp };
  }

  async getYJ(cookie: string) {
    const response = await this.client.get('/ver/8.4/webmail.js', {
      headers: { Cookie: cookie },
    });
    // @ts-ignore
    const match = response.data.match(/&yj=([^&]+)&v=/s);
    return match ? match[1] : null;
  }

  shouldIncludeEmail(email: any, filteredSearch: string) {
    return Object.entries(filteredSearch).every(([key, value]) => {
      switch (key) {
        case 'id':
          return email.id === value;
        case 'from':
          return email.from === value;
        case 'subject':
          return email.subject === value;
        case 'timestamp':
          return email.timestamp === value;
        default:
          return false;
      }
    });
  }

  getDetailInboxFromPage(html: string, filteredSearch: any) {
    const $ = cheerio.load(html);
    const elements = $('.m');
    return elements
      .map((index, element) => this.parseEmail(element))
      .toArray()
      .filter((email) => this.shouldIncludeEmail(email, filteredSearch));
  }

  async fetchInboxPage(
    mail: string,
    yp: string,
    yj: string,
    pageNumber: number,
    cookie: string,
  ) {
    return await this.client.get(
      `/es/inbox?login=${mail}&p=${pageNumber}&d=&ctrl=&yp=${yp}&yj=${yj}&v=8.4&r_c=&id=`,
      {
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          cookie: `${cookie}; compte=${mail}; ywm=${mail}; _ga=GA1.2.490358059.1683208319; _gid=GA1.2.1148489241.1683208319; __gads=ID=8e03875306c449c6-22790dab88df0074:T=1683208320:RT=1683208320:S=ALNI_MasidzVb7xQcb0qS7Hrb-gTpCYFkQ; __gpi=UID=0000057b04df1c7f:T=1683208320:RT=1696576052:S=ALNI_MYMeBMqh92Qfh-oIx02VDmWeqsdAA; compte=${mail}; ywm=${mail}; ytime=15:7;`,
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'es-ES,es;q=0.9',
          connection: 'keep-alive',
          host: 'yopmail.com',
          referer: 'https://yopmail.com/es/wm',
          'sec-ch-ua':
            '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': 'Windows',
          'sec-fetch-dest': 'iframe',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'same-origin',
          'upgrade-insecure-requests': '1',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        },
      },
    );
  }

  async getTotalMails(html: string) {
    const match = html.match(/w\.finrmail\((.*?)\)/);
    let totalMails = 0;
    if (match) {
      totalMails = Number(match[1].split(',')[0]);
    }
    return totalMails;
  }

  private possibleKeys = ['id', 'from', 'subject', 'timestamp'];

  async validateSearch(search: any) {
    const result = this.possibleKeys.some(
      (key) => Object.keys(search).includes(key) || null,
    );
    if (!result) {
      throw new Error('Invalid search');
    }
    return Object.keys(search).reduce((acc: any, key) => {
      if (this.possibleKeys.includes(key)) {
        acc[key] = search[key];
      }
      return acc;
    }, {});
  }

  parseEmail(element: any) {
    const $ = cheerio.load(element);
    const id = $(element).attr('id');
    const timestamp = $(element).find('.lmh').text();
    const from = $(element).find('.lmf').text();
    const subject = $(element).find('.lms').text();
    return { id: id, from: from, subject: subject, timestamp: timestamp };
  }

  async detailInbox(
    mail: string,
    yp: any,
    yj: string,
    cookie: string,
    search = {},
    settings: { GET_ALL_MAILS?: boolean } = {},
  ) {
    const pageNumber = 1;
    const response = await this.fetchInboxPage(
      mail,
      yp,
      yj,
      pageNumber,
      cookie,
    );
    const inboxHtml = response.data;
    const totalMails = await this.getTotalMails(inboxHtml);
    let filteredSearch = {};
    if (search && Object.keys(search).length > 0) {
      filteredSearch = await this.validateSearch(search);
    }
    let currentPage = 1;
    let hasNextPage = true;
    let mailFromPage: any = {};
    const mailsPerPage = 15;
    const emails = [];
    while (
      hasNextPage &&
      (settings.GET_ALL_MAILS === true || currentPage === 1)
    ) {
      const currentPageHtml =
        currentPage === 1
          ? inboxHtml
          : (await this.fetchInboxPage(mail, yp, yj, currentPage, cookie)).data;
      const currentPageEmails = this.getDetailInboxFromPage(
        currentPageHtml,
        filteredSearch,
      );
      mailFromPage[`page_${currentPage}`] = currentPageEmails.length;
      emails.push(...currentPageEmails);
      if (currentPage * mailsPerPage >= totalMails) {
        hasNextPage = false;
      } else {
        currentPage += 1;
      }
    }
    return {
      settings: settings,
      search: filteredSearch,
      totalInbox: totalMails,
      totalPages: Math.ceil(totalMails / mailsPerPage),
      mailFromPage: mailFromPage,
      totalGetMails: emails.length,
      inbox: emails,
    };
  }

  async readMessage(
    mail: string,
    id: string,
    format: string,
    selector = '',
  ): Promise<any> {
    try {
      const { cookie: cookie } = await this.getCookiesAndYP();
      const response = await this.client.get(`/es/mail?b=${mail}&id=m${id}`, {
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          cookie: `${cookie}; compte=${mail}; ywm=${mail}; _ga=GA1.2.490358059.1683208319; _gid=GA1.2.1148489241.1683208319; __gads=ID=8e03875306c449c6-22790dab88df0074:T=1683208320:RT=1683208320:S=ALNI_MasidzVb7xQcb0qS7Hrb-gTpCYFkQ; __gpi=UID=0000057b04df1c7f:T=1683208320:RT=1696576052:S=ALNI_MYMeBMqh92Qfh-oIx02VDmWeqsdAA; compte=${mail}; ywm=${mail}; ytime=15:7;`,
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'es-ES,es;q=0.9',
          connection: 'keep-alive',
          host: 'yopmail.com',
          referer: 'https://yopmail.com/es/wm',
          'sec-ch-ua':
            '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': 'Windows',
          'sec-fetch-dest': 'iframe',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'same-origin',
          'upgrade-insecure-requests': '1',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        },
      });
      const $ = cheerio.load(response.data);
      const submit = $('div.fl\x20>\x20div.ellipsis.nw.b.f18').text();
      const fromSelector = $(
        'div.fl > div.md.text.zoom.nw.f24 > span.ellipsis.b\n',
      );
      const dateSelector = $(
        'div.fl > div.md.text.zoom.nw.f24 > span.ellipsis:last-child',
      );
      const from = fromSelector.length
        ? fromSelector.text()
        : $('div.fl > div.md.text.zoom.nw.f18 > span.ellipsis.b').text();
      const date = dateSelector.length
        ? dateSelector.text().replace(from, '')
        : $(
            'div.fl\x20>\x20div.md.text.zoom.nw.f18\x20>\x20span.ellipsis:last-child',
          ).text();
      let message;
      if (selector) {
        selector = `${'#mail'} ${selector}`;
        message =
          format.toLowerCase() === 'html'
            ? $(selector).html()
            : $(selector).text().trim();
      } else {
        selector = '#mail';
        message =
          format.toLowerCase() === 'html'
            ? $(selector).html()
            : $(selector).text().trim();
      }
      return {
        id: id,
        submit: submit,
        from: from,
        date: date,
        selector: selector,
        format: format,
        data: message,
      };
    } catch (e) {
      console.error(e);
    }
  }
}
