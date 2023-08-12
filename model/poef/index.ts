import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Browser, EventEmitter, Page } from 'puppeteer';
import { BrowserPool, BrowserUser, simplifyPage } from '../../pool/puppeteer';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  isSimilarity,
  maskLinks,
  MessageData,
  parseJSON,
  shuffleArray,
} from '../../utils';
import { v4 } from 'uuid';

import fs from 'fs';
import moment from 'moment';
import {
  CreateEmail,
  TempEmailType,
  TempMailMessage,
} from '../../utils/emailFactory';
import { sleep } from '../../utils';
import { TimeFormat } from '../../utils';

const ModelMap: Partial<Record<ModelType, any>> = {
  [ModelType.GPT4]: 'GPT-4',
  [ModelType.Sage]: 'Assistant',
  [ModelType.Claude100k]: 'Claude-instant-100k',
  [ModelType.ClaudeInstance]: 'Claude-instant',
  [ModelType.GPT3p5Turbo]: 'ChatGPT',
  [ModelType.GooglePalm]: 'Google-PaLM',
  [ModelType.Claude2_100k]: 'Claude-2-100k',
  [ModelType.Llama_2_70b]: 'Llama-2-70b',
  [ModelType.Llama_2_13b]: 'Llama-2-13b',
  [ModelType.Llama_2_7b]: 'Llama-2-7b',
};

type UseLeftInfo = {
  daily: number;
  monthly: number;
};

const MaxFailedTimes = 10;

type UseLeft = Partial<Record<ModelType, UseLeftInfo>>;

type Account = {
  id: string;
  email?: string;
  login_time?: string;
  last_use_time?: string;
  pb: string;
  failedCnt: number;
  use_left?: UseLeft;
};

type HistoryData = {
  data: {
    query: string;
    result: string;
    created_at: string;
  }[];
};

interface Messages {
  id: string;
  messageId: number;
  creationTime: number;
  clientNonce: null;
  state: string;
  text: string;
  author: string;
  linkifiedText: string;
  contentType: string;
  attachments: any[];
  vote: null;
  suggestedReplies: string[];
  linkifiedTextLengthOnCancellation: null;
  textLengthOnCancellation: null;
  voteReason: null;
  __isNode: string;
}

interface Data {
  messageAdded: Messages;
}

interface Payload {
  unique_id: string;
  subscription_name: string;
  data: Data;
}

interface RootObject {
  message_type: string;
  payload: Payload;
}

interface RealAck {
  messages: string[];
  min_seq: number;
}

class PoeAccountPool {
  private pool: Account[] = [];
  private using = new Set<string>();
  private readonly account_file_path = './run/account_poef.json';

  constructor() {
    let pbList = process.env.POEF_PB ? process.env.POEF_PB.split('|') : [];
    pbList = Array.from(new Set(pbList));
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, [] as Account[]);
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    const pbMap: Record<string, Account> = {};
    for (const v of this.pool) {
      v.failedCnt = 0;
      pbMap[v.pb] = v;
    }
    for (const pb of pbList) {
      if (pbMap[pb]) {
        continue;
      }
      this.pool.push({
        id: v4(),
        pb,
        failedCnt: 0,
      });
    }
    console.log(`read poef old account total:${Object.keys(this.pool).length}`);
    this.syncfile();
  }

  public syncfile() {
    fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
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
      if (
        // 如果没到一天，并且有剩余次数为0 则不启用
        moment()
          .subtract(1, 'day')
          .subtract(1, 'hours')
          .isBefore(moment(vv.last_use_time)) &&
        vv.use_left &&
        Object.values(vv.use_left).find((v) => v.daily === 0)
      ) {
        continue;
      }
      this.using.add(vv.id);
      vv.failedCnt = 0;
      return vv;
    }
    console.log('poef pb run out!!!!!!');
    const newV: Account = {
      id: v4(),
      pb: '',
      failedCnt: 0,
    };
    this.pool.push(newV);
    return newV;
  }
}

interface PoeChatRequest extends ChatRequest {
  retry?: number;
}

export class Poef extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: PoeAccountPool;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new PoeAccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.POEF_POOL_SIZE || 0),
      this,
      false,
      -1,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Claude100k:
        return 50000;
      case ModelType.ClaudeInstance:
        return 4000;
      case ModelType.GPT4:
        return 4500;
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.Llama_2_7b:
        return 3000;
      case ModelType.Llama_2_13b:
        return 3000;
      case ModelType.Llama_2_70b:
        return 3000;
      case ModelType.Sage:
        return 4000;
      case ModelType.GooglePalm:
        return 4000;
      case ModelType.Claude2_100k:
        return 80000;
      default:
        return 0;
    }
  }

  public async ask(req: ChatRequest): Promise<ChatResponse> {
    const et = new EventStream();
    const res = await this.askStream(req, et);
    const result: ChatResponse = {
      content: '',
    };
    return new Promise((resolve) => {
      et.read(
        (event, data) => {
          if (!data) {
            return;
          }
          switch (event) {
            case 'message':
              result.content += (data as MessageData).content;
              break;
            case 'done':
              result.content += (data as DoneData).content;
              break;
            case 'error':
              result.error += (data as ErrorData).error;
              break;
            default:
              console.error(data);
              break;
          }
        },
        () => {
          resolve(result);
        },
      );
    });
  }

  deleteID(id: string): void {
    this.accountPool.delete(id);
  }

  newID(): string {
    const account = this.accountPool.get();
    return account.id;
  }

  public async getUseLeft(page: Page): Promise<UseLeft> {
    await page.goto('https://poe.com/settings');
    await page.waitForSelector(
      '.SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW > .SettingsSubscriptionSection_botLimitSection__j4mSO > .SettingsSubscriptionSection_sectionBubble__nlU_b:nth-child(1) > .SettingsSubscriptionSection_title__aFmeI',
    );
    const length: number = await page.evaluate(
      () =>
        // @ts-ignore
        document.querySelector(
          '.PageWithSidebarLayout_mainSectionWrapper__S1TJJ > .PageWithSidebarLayout_scrollSection__IRP9Y > .PageWithSidebarLayout_mainSection__i1yOg > .SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW',
        ).children[2].children.length,
    );
    const useLeft: UseLeft = {};
    for (let i = 0; i < length; i++) {
      // @ts-ignore
      const title: string = await page.evaluate(
        (idx) =>
          // @ts-ignore
          document.querySelector(
            '.PageWithSidebarLayout_mainSectionWrapper__S1TJJ > .PageWithSidebarLayout_scrollSection__IRP9Y > .PageWithSidebarLayout_mainSection__i1yOg > .SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW',
          ).children[2].children[idx].children[0].textContent,
        i,
      );
      // @ts-ignore
      const left: string = await page.evaluate(
        (idx) =>
          // @ts-ignore
          document.querySelector(
            '.PageWithSidebarLayout_mainSectionWrapper__S1TJJ > .PageWithSidebarLayout_scrollSection__IRP9Y > .PageWithSidebarLayout_mainSection__i1yOg > .SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW',
          ).children[2].children[idx].children[1].textContent,
        i,
      );
      const { daily, monthly } = this.extractRemaining(left);
      for (const model in ModelMap) {
        // @ts-ignore
        const v = ModelMap[model];
        if (this.extractModelName(title).toUpperCase() === v.toUpperCase()) {
          // @ts-ignore
          useLeft[model] = { daily, monthly } as UseLeftInfo;
        }
      }
    }
    return useLeft;
  }

  extractModelName(input: string): string {
    const match = input.match(/([A-Za-z0-9\-]+)/);
    return match ? match[0] : '';
  }

  extractRemaining(text: string): { daily: number; monthly: number } {
    const dailyMatch = text.match(
      /Daily \(free\)(\d*|Not currently available) left/,
    );
    const monthlyMatch = text.match(/Monthly \(subscription\)(\d+) left/);

    const dailyRemaining =
      dailyMatch && dailyMatch[1] !== 'Not currently available'
        ? parseInt(dailyMatch[1], 10)
        : 0;
    const monthlyRemaining = monthlyMatch ? parseInt(monthlyMatch[1], 10) : 0;

    return { daily: dailyRemaining, monthly: monthlyRemaining };
  }

  async closeWelcome(page: Page) {
    try {
      await page.waitForSelector(
        'body > div:nth-child(15) > div > div > div > button',
        { timeout: 10 * 1000 },
      );
      await page.click('body > div:nth-child(15) > div > div > div > button');
      this.logger.info('close welcome failed');
    } catch (e) {}
  }

  async init(
    id: string,
    browser: Browser,
  ): Promise<[Page | undefined, Account]> {
    const account = this.accountPool.getByID(id);
    if (!account) {
      throw new Error('get account failed');
    }
    const page = await browser.newPage();
    await simplifyPage(page);
    try {
      if (account.pb) {
        await page.setCookie({
          name: 'p-b',
          value: account.pb,
          domain: 'poe.com',
        });
        await page.goto(`https://poe.com/${ModelMap[ModelType.GPT3p5Turbo]}`);
        if (await Poef.isLogin(page)) {
          account.use_left = await this.getUseLeft(page);
          this.logger.info(`${account.id} still login`);
          return [page, account];
        }
      }
      await page.goto('https://poe.com');

      // await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0');
      await page.waitForSelector(
        '.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .MainSignupLoginSection_inputAndMetaTextGroup__5ITsJ > .EmailInput_wrapper__D9Dss > .EmailInput_emailInput__4v_bn',
        { timeout: 600000 },
      );
      const emailBox = CreateEmail(TempEmailType.Gmail);
      const emailAddress = await emailBox.getMailAddress();
      // const emailAddress = 'backs-walkout-0o@icloud.com';
      // 输入邮箱
      await page.waitForSelector(
        '.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .MainSignupLoginSection_inputAndMetaTextGroup__5ITsJ > .EmailInput_wrapper__D9Dss > .EmailInput_emailInput__4v_bn',
      );
      await page.click(
        '.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .MainSignupLoginSection_inputAndMetaTextGroup__5ITsJ > .EmailInput_wrapper__D9Dss > .EmailInput_emailInput__4v_bn',
      );
      // 将文本键入焦点元素
      await page.keyboard.type(emailAddress, { delay: 50 });
      await page.keyboard.press('Enter');
      // 发送code
      await page.waitForSelector(
        'body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn',
      );
      await page.click(
        'body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn',
      );

      const msgs = (await emailBox.waitMails()) as TempMailMessage[];
      let validateURL: string | undefined;
      for (const msg of msgs) {
        validateURL = msg.content.match(/>(\d{6})</i)?.[1];
        if (validateURL) {
          break;
        }
      }
      if (!validateURL) {
        throw new Error('Error while obtaining verfication URL!');
      }
      // 输入code
      await page.waitForSelector(
        '.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .SignupOrLoginWithCodeSection_inputAndMetaTextGroup__ubLLI > .VerificationCodeInput_wrapper__ayRfN > .VerificationCodeInput_verificationCodeInput__YD3KV',
      );
      await page.click(
        '.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .SignupOrLoginWithCodeSection_inputAndMetaTextGroup__ubLLI > .VerificationCodeInput_wrapper__ayRfN > .VerificationCodeInput_verificationCodeInput__YD3KV',
      );
      await page.type(
        '.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .SignupOrLoginWithCodeSection_inputAndMetaTextGroup__ubLLI > .VerificationCodeInput_wrapper__ayRfN > .VerificationCodeInput_verificationCodeInput__YD3KV',
        validateURL,
      );

      // 提交code
      await page.waitForSelector(
        'body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn',
      );
      await page.click(
        'body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn',
      );
      await page.waitForSelector(
        `.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .ChatMessageInputContainer_inputContainer__SQvPA > .GrowingTextArea_growWrap___1PZM > .GrowingTextArea_textArea__eadlu`,
        { timeout: 30 * 60 * 1000 },
      );

      account.use_left = await this.getUseLeft(page);
      account.pb =
        (await page.cookies()).find((v) => v.name === 'p-b')?.value || '';
      if (!account.pb) {
        throw new Error('get account pb failed');
      }
      await this.closeWelcome(page);
      this.accountPool.syncfile();
      this.logger.info(`init ok! ${account.id}`);
      return [page, account];
    } catch (e: any) {
      this.logger.warn(`account:${account?.id}, something error happened.`, e);
      return [] as any;
    }
  }

  public static async isLogin(page: Page) {
    try {
      await page.waitForSelector(Poef.InputSelector, { timeout: 5 * 1000 });
      return true;
    } catch (e: any) {
      return false;
    }
  }

  public static InputSelector =
    '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .ChatMessageInputContainer_inputContainer__SQvPA > .GrowingTextArea_growWrap___1PZM > .GrowingTextArea_textArea__eadlu';
  public static ClearSelector =
    '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .Button_buttonBase__0QP_m > svg > path';

  public static async clearContext(page: Page) {
    await page.waitForSelector(Poef.ClearSelector, { timeout: 10 * 60 * 1000 });
    await page.click(Poef.ClearSelector);
  }

  public async askStream(req: PoeChatRequest, stream: EventStream) {
    req.prompt = req.prompt.replace(/assistant/g, 'result');
    req.prompt = maskLinks(req.prompt);
    if (
      req.model === ModelType.Claude2_100k ||
      req.model === ModelType.Claude100k ||
      req.model === ModelType.Claude ||
      req.model === ModelType.ClaudeInstance
    ) {
      const question = req.messages?.[req.messages.length - 1]?.content || '';

      req.prompt = `我会把我们的历史对话放在<history>标签内部，请你回答我的问题
<history>
${req.messages
  .slice(0, req.messages.length - 1)
  .map((v) => `${v.role === 'user' ? 'user: ' : 'result: '}${v.content}`)
  .join('\n')}
</history>
${question}`;
    }
    const [page, account, done, destroy] = this.pagePool.get();
    if (!account || !page) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    account.last_use_time = moment().format('YYYY-MM-DD HH:mm:ss');

    // 次数判断与减少
    const useleft = account.use_left?.[req.model];
    if (useleft) {
      if (useleft.daily === 0) {
        stream.write(Event.error, { error: 'please retry later!' });
        stream.write(Event.done, { content: '' });
        stream.end();
        destroy();
        return;
      }
      useleft.daily -= 1;
      this.logger.info(
        `pb ${account.pb} ${req.model} left -> daily:[${useleft.daily}]`,
      );
    }

    let url = page?.url();
    if (!url) {
      await page?.reload();
      url = page?.url();
    }
    const target = ModelMap[req.model];
    this.logger.info(`poe now in ${url}, target:${target}`);
    if (!url?.endsWith(target)) {
      await page?.goto(`https://poe.com/${target}`);
      this.logger.info(`poe go to ${target} ok`);
    }
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    try {
      let old = '';
      const tt = setTimeout(async () => {
        client.removeAllListeners('Network.webSocketFrameReceived');
        await Poef.clearContext(page);
        await sleep(2000);
        account.failedCnt += 1;
        this.accountPool.syncfile();
        if (account.failedCnt >= MaxFailedTimes) {
          destroy(true);
          this.accountPool.syncfile();
          this.logger.info(`poe account failed cnt > 10, destroy ok`);
        } else {
          await page.reload();
          done(account);
        }
        if (!stream.stream().writableEnded && !stream.stream().closed) {
          if ((req?.retry || 0) > 3) {
            this.logger.info('poe try times > 3, return error');
            stream.write(Event.error, { error: 'please retry later!' });
            stream.write(Event.done, { content: '' });
            stream.end();
            return;
          }
          this.logger.error(
            `pb ${account.pb} wait ack ws timeout, retry! failedCnt:${account.failedCnt}`,
          );
          req.retry = req.retry ? req.retry + 1 : 1;
          await this.askStream(req, stream);
        }
      }, 20 * 1000);
      let currMsgID = '';
      client.on('Network.webSocketFrameReceived', async ({ response }) => {
        tt.refresh();
        const data = parseJSON(response.payloadData, {} as RealAck);
        const obj = parseJSON(data.messages[0], {} as RootObject);
        const { unique_id } = obj.payload || {};
        const message = obj?.payload?.data?.messageAdded;
        if (!message) {
          return;
        }
        const { author, state, text } = message;
        // this.logger.info(author, state, text, unique_id);

        if (author === 'chat_break') {
          return;
        }
        if (author === 'human' && isSimilarity(text, req.prompt)) {
          currMsgID = unique_id;
          return;
        }
        if (unique_id !== currMsgID) {
          // this.logger.info(`message id different`, {unique_id, currMsgID});
          return;
        }
        switch (state) {
          case 'complete':
            clearTimeout(tt);
            client.removeAllListeners('Network.webSocketFrameReceived');
            if (text.length > old.length) {
              stream.write(Event.message, {
                content: text.substring(old.length),
              });
            }
            stream.write(Event.done, { content: '' });
            stream.end();
            await Poef.clearContext(page);
            await sleep(2000);
            account.failedCnt = 0;
            account.last_use_time = moment().format(TimeFormat);
            this.accountPool.syncfile();
            if (useleft && useleft.daily <= 0) {
              destroy();
            } else {
              done(account);
            }
            this.logger.info('poe recv msg complete');
            return;
          case 'incomplete':
            if (text.length > old.length) {
              stream.write(Event.message, {
                content: text.substring(old.length),
              });
              old = text;
            }
            return;
        }
      });
      this.logger.info('poe start send msg');
      await Poef.clearContext(page);
      await page.waitForSelector(Poef.InputSelector);
      await page.click(Poef.InputSelector);
      await page.type(Poef.InputSelector, `1`);
      this.logger.info('poe find input ok');
      const input = await page.$(Poef.InputSelector);
      //@ts-ignore
      await input?.evaluate((el, content) => (el.value = content), req.prompt);
      await page.keyboard.press('Enter');
      this.logger.info('send msg ok!');
    } catch (e: any) {
      client.removeAllListeners('Network.webSocketFrameReceived');
      this.logger.error(`account: pb=${account.pb}, poe ask stream failed:`, e);
      account.failedCnt += 1;
      if (account.failedCnt >= MaxFailedTimes) {
        destroy();
        this.accountPool.syncfile();
        this.logger.info(`poe account failed cnt > 10, destroy ok`);
      } else {
        this.accountPool.syncfile();
        await page.reload();
        done(account);
      }
      done(account);
      stream.write(Event.error, { error: 'some thing error, try again later' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
  }
}
