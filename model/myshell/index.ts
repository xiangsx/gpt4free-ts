import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, Page, Protocol } from 'puppeteer';
import { BrowserPool, BrowserUser, simplifyPage } from '../../utils/puppeteer';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
  shuffleArray,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';

import fs from 'fs';
import moment from 'moment';
import {
  CreateEmail,
  TempEmailType,
  TempMailMessage,
} from '../../utils/emailFactory';
import { CreateAxiosProxy, WSS } from '../../utils/proxyAgent';
import { match } from 'assert';

const ModelMap: Partial<Record<ModelType, any>> = {
  [ModelType.GPT4]: '01c8de4fbfc548df903712b0922a4e01',
  [ModelType.GPT3p5Turbo]: '8077335db7cd47e29f7de486612cc7fd',
};

const MaxFailedTimes = 10;

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time: number;
  failedCnt: number;
  battery: number;
  token: string;
  visitorID: string;
};

interface ReplyMessage {
  id: number;
  uid: string;
  userId: number;
  userUid: string;
  type: string;
  botId: number;
  replyUid: string;
  status: string;
  text: string | null;
  handled: boolean;
  translation: string | null;
  voiceUrl: string | null;
  createdDate: string;
  updatedDate: string;
  botUid: string;
}

interface TextStreamData {
  replyMessage: ReplyMessage;
  index: number;
  text: string;
  isFinal: boolean;
}

interface TextStream {
  reqId: string;
  traceId: string;
  data: TextStreamData;
}

class PoeAccountPool {
  private pool: Account[] = [];
  private using = new Set<string>();
  private readonly account_file_path = './run/account_myshell.json';

  constructor() {
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, [] as Account[]);
      if (!Array.isArray(this.pool)) {
        this.pool = [];
        this.syncfile();
      }
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    for (const v of this.pool) {
      v.failedCnt = 0;
      v.last_use_time = moment().unix();
      v.battery =
        v.battery +
        Math.floor((moment().unix() - v.last_use_time) / 60 / 60) * 8;
    }
    console.log(
      `read myshell old account total:${Object.keys(this.pool).length}`,
    );
    this.syncfile();
  }

  public syncfile() {
    fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
  }

  public release(id: string) {
    this.using.delete(id);
  }

  public getByID(id: string) {
    for (const item in this.pool) {
      if (this.pool[item].id === id) {
        return this.pool[item];
      }
    }
  }

  public delete(id: string) {
    for (const v in this.pool) {
      const vv = this.pool[v];
    }
    this.using.delete(id);
    this.syncfile();
  }

  public get(): Account {
    for (const vv of shuffleArray(this.pool)) {
      if (this.using.has(vv.id)) {
        continue;
      }
      if (!vv.token || !vv.visitorID) {
        continue;
      }
      if (vv.battery < 30) {
        continue;
      }
      this.using.add(vv.id);
      vv.failedCnt = 0;
      return vv;
    }
    console.log('myshell account run out, register new now!');
    const newV: Account = {
      id: v4(),
      failedCnt: 0,
      battery: 0,
      token: '',
      visitorID: '',
      last_use_time: moment().unix(),
    };
    this.pool.push(newV);
    return newV;
  }
}

export class MyShell extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: PoeAccountPool;
  private wssMap: Record<string, WSS> = {};

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new PoeAccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.MYSHELL_POOL_SIZE || 0),
      this,
      false,
      10000,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 1500;
      case ModelType.GPT3p5Turbo:
        return 1500;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: true,
      countPrompt: true,
      forceRemove: true,
    });
  }

  deleteID(id: string): void {
    this.accountPool.delete(id);
  }

  release(id: string): void {
    this.accountPool.release(id);
  }

  newID(): string {
    const account = this.accountPool.get();
    return account.id;
  }

  async init(
    id: string,
    browser: Browser,
  ): Promise<[Page | undefined, Account]> {
    const account = this.accountPool.getByID(id);
    if (!account) {
      await sleep(10 * 24 * 60 * 60 * 1000);
      return [] as any;
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await simplifyPage(page);
    try {
      if (!account.token) {
        await page.goto('https://app.myshell.ai/');
        // await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0');
        await page.waitForSelector(
          '.relative > #sidebar > .overflow-hidden > .justify-center > .chakra-button',
        );
        await page.click(
          '.relative > #sidebar > .overflow-hidden > .justify-center > .chakra-button',
        );

        await page.waitForSelector(`.chakra-form-control > div`);
        await page.click(`.chakra-form-control > div`);
        const emailBox = CreateEmail(
          (process.env.MYSHELL_MAIL_TYPE as TempEmailType) ||
            TempEmailType.TempMailLOL,
        );
        const emailAddress = await emailBox.getMailAddress();
        await page.keyboard.type(emailAddress);

        await page.waitForSelector(`.chakra-form-control > button`);
        await page.click(`.chakra-form-control > button`);

        const msgs = (await emailBox.waitMails()) as TempMailMessage[];
        let validateURL: string | undefined;
        for (const msg of msgs) {
          validateURL = (msg as any).body.match(/(\d{6})/i)?.[1];
          if (validateURL) {
            break;
          }
        }
        if (!validateURL) {
          throw new Error('Error while obtaining verfication URL!');
        }
        this.logger.info(validateURL);
        const frame = await page.waitForFrame(
          (v) => v.url().indexOf('particle') > -1,
        );
        await sleep(10000);
        await frame.waitForSelector('.react-input-code > .input-code-item');
        await frame.click('.react-input-code > .input-code-item');
        await frame.focus('.react-input-code > .input-code-item');
        await page.keyboard.type(validateURL, { delay: 10 });

        // continue talk
        await page.waitForSelector('body > div > button');
        await page.click('body > div > button');

        await this.enterInviteCode(page);

        await this.getFreeTrail(page);

        await this.getChatBooster(page);

        // await sleep(10 * 60 * 1000);
        await page.goto(`https://app.myshell.ai/chat`);
        account.token = await this.getToken(page);
        account.visitorID = await this.getVisitorId(page);
        account.battery = (await this.getBattery(account.token)).energy;
        this.accountPool.syncfile();
      }
      const wss = await this.initWSS(
        account.token,
        account.visitorID,
        (v: WSS) => {
          this.wssMap[account.id] = v;
        },
      );
      this.wssMap[account.id] = wss;
      this.logger.info(`init ok! ${account.id}`);
      await browser.close();
      return [page, account];
    } catch (e: any) {
      await page.screenshot({ path: `./run/error_${account.id}.png` });
      await browser.close();
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      return [] as any;
    }
  }

  async enterInviteCode(page: Page) {
    try {
      await page.waitForSelector(
        '#shell > aside > div.relative.h-full > div > div > div > div > div > button:nth-child(2)',
      );
      await page.click(
        '#shell > aside > div.relative.h-full > div > div > div > div > div > button:nth-child(2)',
      );

      await page.waitForSelector(
        '#shell > aside > div.relative.h-full > div > div > div > div > div > input',
      );
      await page.click(
        '#shell > aside > div.relative.h-full > div > div > div > div > div > input',
      );
      await page.keyboard.type('26e86e', { delay: 10 });
      await page.waitForSelector(
        '#shell > aside > div.relative.h-full > div > div > div > div > div > button',
      );
      await page.click(
        '#shell > aside > div.relative.h-full > div > div > div > div > div > button',
      );
    } catch (e) {
      this.logger.error('enterInviteCode failed, ', e);
    }
  }

  async getFreeTrail(page: Page) {
    try {
      await page.goto('https://app.myshell.ai/rewards-center/earn');
      await sleep(2000);
      await page.waitForSelector('#edit > div > * > div > div > button');
      await page.click('#edit > div > * > div > div > button');
    } catch (e) {}
  }

  async getBattery(token: string) {
    const res = await CreateAxiosProxy({}).get(
      `https://api.myshell.ai/user/getUserEnergyInfo`,
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );
    return res.data as { energy: number; dailyEnergy: number };
  }

  async initWSS(
    token: string,
    visitorID: string,
    recreate: (wss: WSS) => void,
  ): Promise<WSS> {
    return new Promise((resolve, reject) => {
      const ws = new WSS('wss://api.myshell.ai/ws/?EIO=4&transport=websocket', {
        onOpen: () => {
          resolve(ws);
          ws.send(`40/chat,{"token":"${token}","visitorId":"${visitorID}"}\t`);
        },
        onMessage: (data: any) => {
          if (data === '2') {
            ws.send('3');
          }
        },
        onClose: async () => {
          recreate(await this.initWSS(token, visitorID, recreate));
        },
        onError: (e: any) => {
          reject(e);
        },
      });
    });
  }

  async getChatBooster(page: Page) {
    try {
      // go to reward
      await page.goto('https://app.myshell.ai/rewards-center');

      await page.waitForSelector(
        '#tabs-sidebar--tabpanel-2 > div > div > div > a:nth-child(4)',
      );
      await page.click(
        '#tabs-sidebar--tabpanel-2 > div > div > div > a:nth-child(4)',
      );

      await sleep(2000);
      // got reward
      await page.waitForSelector('#Rewards > div > div > div > div > * > img', {
        timeout: 10000,
      });
      await page.click('#Rewards > div > div > div > div > * > img');

      // use reward
      await page.waitForSelector(
        '.chakra-modal__body > div > div > div > .chakra-button',
      );
      await page.click(
        '.chakra-modal__body > div > div > div > .chakra-button',
      );

      // got it
      await page.waitForSelector(
        '.chakra-modal__footer > div > .chakra-button',
      );
      await page.click('.chakra-modal__footer > div > .chakra-button');
      await this.getChatBooster(page);
    } catch (e) {
      this.logger.error('getChatBooster error', e);
    }
  }

  async getToken(page: Page) {
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (!token) {
      throw new Error('get token failed');
    }
    return token;
  }

  async getVisitorId(page: Page) {
    const visitorId = await page.evaluate(() =>
      localStorage.getItem('mix_visitorId'),
    );
    if (!visitorId) {
      throw new Error('get visitorId failed');
    }
    return visitorId;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    const ws = this.wssMap[account.id];

    const tt = setTimeout(() => {
      stream.write(Event.error, { error: 'timeout!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      done(account);
    }, 5000);
    const remove = ws.onData((data) => {
      if (data.indexOf('42/chat,') === -1) {
        return;
      }
      const str = data.replace('42/chat,', '');
      const [event, msg] = parseJSON<[string, TextStream]>(str, [
        '',
        {},
      ] as any);
      switch (event) {
        case 'no_enough_energy':
          stream.write(Event.error, { error: 'no_enough_energy' });
          stream.write(Event.done, { content: '' });
          stream.end();
          ws.close();
          destroy();
          return;
        case 'text_stream':
          tt.refresh();
          stream.write(Event.message, { content: msg.data.text });
          break;
        case 'message_replied':
          remove();
          clearTimeout(tt);
          stream.write(Event.done, { content: '' });
          stream.end();
          if (account.battery < 30) {
            destroy();
            return;
          }
          done(account);
          break;
        case 'energy_info':
          account.battery = msg.data as any;
          this.accountPool.syncfile();
          break;
        case 'message_sent':
          this.logger.info('message_sent');
          break;
        case 'reply_message_created':
          this.logger.info('reply_message_created');
          break;
        case 'need_verify_captcha':
          this.logger.warn('need_verify_captcha');
          destroy();
          ws.close();
          stream.write(Event.error, { error: 'need_verify_captcha' });
          stream.end();
          break;
        default:
          this.logger.warn("unknown event: '" + event + "' " + str);
          break;
      }
    });
    const content = JSON.stringify({
      reqId: v4(),
      botUid: ModelMap[req.model],
      text: req.prompt,
      sourceFrom: 'myshellWebsite',
    });
    ws.send(`42/chat,["text_chat", ${content}]`);
    account.last_use_time = moment().unix();
    this.accountPool.syncfile();
  }
}
