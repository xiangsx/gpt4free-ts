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
  extractStrNumber,
  isSimilarity,
  maskLinks,
  MessageData,
  parseJSON,
  shuffleArray,
  sleep,
} from '../../utils';
import { v4 } from 'uuid';
import fs from 'fs';
import moment from 'moment';

const ModelMap: Partial<Record<ModelType, any>> = {
  [ModelType.GPT4]: 'GPT-4',
  [ModelType.Sage]: 'Sage',
  [ModelType.Claude]: 'Claude+',
  [ModelType.Claude100k]: 'Claude-instant-100k',
  [ModelType.ClaudeInstance]: 'Claude-instant',
  [ModelType.GPT3p5Turbo]: 'ChatGPT',
  [ModelType.GPT3p5_16k]: 'ChatGPT-16k',
  [ModelType.Gpt4free]: '1GPT4Free',
  [ModelType.GooglePalm]: 'Google-PaLM',
  [ModelType.Claude2_100k]: 'Claude-2-100k',
  [ModelType.GPT4_32k]: 'GPT-4-32K',
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
  invalid?: boolean;
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
  private pool: Record<string, Account> = {};
  private using = new Set<string>();
  private readonly account_file_path = './run/account_poe.json';

  constructor() {
    const pbList = (process.env.POE_PB || '').split('|');
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, {} as Record<string, Account>);
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    for (const key in this.pool) {
      this.pool[key].failedCnt = 0;
    }
    for (const pb of pbList) {
      if (this.pool[pb]) {
        continue;
      }
      this.pool[pb] = {
        id: v4(),
        pb,
        failedCnt: 0,
        invalid: false,
      };
    }
    console.log(`read poe account total:${Object.keys(this.pool).length}`);
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
    for (const vv of shuffleArray(Object.values(this.pool))) {
      if (vv.invalid) {
        continue;
      }
      if (this.using.has(vv.id)) {
        continue;
      }
      if (
        moment().subtract(1, 'day').subtract(1, 'hours') >
          moment(vv.last_use_time) &&
        vv.use_left &&
        vv.use_left[ModelType.GPT4]?.daily === 0 &&
        vv.use_left[ModelType.GPT4]?.monthly === 0
      ) {
        continue;
      }
      this.using.add(vv.id);
      vv.failedCnt = 0;
      return vv;
    }
    console.log('poe pb run out!!!!!!');
    return {
      id: v4(),
      pb: '',
      failedCnt: 0,
    } as Account;
  }
}

interface PoeChatRequest extends ChatRequest {
  retry?: number;
}

export class Poe extends Chat implements BrowserUser<Account> {
  private pagePool: BrowserPool<Account>;
  private accountPool: PoeAccountPool;

  constructor(options?: ChatOptions) {
    super(options);
    this.accountPool = new PoeAccountPool();
    this.pagePool = new BrowserPool<Account>(
      +(process.env.POE_POOL_SIZE || 0),
      this,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.ClaudeInstance:
        return 4000;
      case ModelType.Claude100k:
        return 50000;
      case ModelType.Claude:
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
      case ModelType.GPT3p5_16k:
        return 15000;
      case ModelType.Gpt4free:
        return 4000;
      case ModelType.Sage:
        return 4000;
      case ModelType.GooglePalm:
        return 4000;
      case ModelType.GPT4_32k:
        return 20000;
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

  release(id: string): void {
    this.accountPool.release(id);
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
          '.SidebarLayout_main__x1QPg > .MainColumn_scrollSection__TuAiS > .MainColumn_column__z1_q8 > .SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW',
        ).children[2].children.length,
    );
    const useLeft: UseLeft = {};
    for (let i = 0; i < length; i++) {
      // @ts-ignore
      const title: string = await page.evaluate(
        (idx) =>
          // @ts-ignore
          document.querySelector(
            '.SidebarLayout_main__x1QPg > .MainColumn_scrollSection__TuAiS > .MainColumn_column__z1_q8 > .SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW',
          ).children[2].children[idx].children[0].textContent,
        i,
      );
      // @ts-ignore
      const left: string = await page.evaluate(
        (idx) =>
          // @ts-ignore
          document.querySelector(
            '.SidebarLayout_main__x1QPg > .MainColumn_scrollSection__TuAiS > .MainColumn_column__z1_q8 > .SettingsPageMain_container__3Se4O > .SettingsSubscriptionSection_subscriptionSettingsContainer__DfZCW',
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
    await simplifyPage(page);
    try {
      await page.setCookie({
        name: 'p-b',
        value: account.pb,
        domain: 'poe.com',
      });
      await page.goto(`https://poe.com/GPT-4-32K`);
      if (!(await Poe.isLogin(page))) {
        account.invalid = true;
        this.accountPool.syncfile();
        throw new Error(`account:${account?.pb}, no login status`);
      }
      await page.waitForSelector(Poe.InputSelector, {
        timeout: 30 * 1000,
        visible: true,
      });
      await page.click(Poe.InputSelector);
      await page.type(Poe.InputSelector, `1`);
      if (process.env.POE_ALLOW_FREE !== '1' && !(await Poe.isVIP(page))) {
        account.invalid = true;
        this.accountPool.syncfile();
        throw new Error(`account:${account?.pb}, not vip`);
      }
      account.use_left = await this.getUseLeft(page);
      this.accountPool.syncfile();
      this.logger.info(`poe init ok! ${account.pb}`);
      return [page, account];
    } catch (e: any) {
      account.failedCnt += 1;
      this.accountPool.syncfile();
      this.logger.warn(`account:${account?.pb}, something error happened.`, e);
      return [] as any;
    }
  }

  public static async isVIP(page: Page) {
    try {
      await page.waitForSelector(Poe.FreeModal, { timeout: 5 * 1000 });
      return false;
    } catch (e: any) {
      return true;
    }
  }

  public static async isLogin(page: Page) {
    try {
      await page.waitForSelector(Poe.TalkToGpt, { timeout: 5 * 1000 });
      return false;
    } catch (e: any) {
      return true;
    }
  }

  public static InputSelector =
    '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .ChatMessageInputContainer_inputContainer__SQvPA > .GrowingTextArea_growWrap___1PZM > .GrowingTextArea_textArea__eadlu';
  public static ClearSelector =
    '.ChatPageMain_container__1aaCT > .ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .Button_buttonBase__0QP_m > svg';
  public static FreeModal =
    '.ReactModal__Body--open > .ReactModalPortal > .ReactModal__Overlay > .ReactModal__Content';
  public static TalkToGpt =
    'body > #__next > .LoggedOutBotInfoPage_layout__Y_z0i > .LoggedOutBotInfoPage_botInfo__r2z3X > .LoggedOutBotInfoPage_appButton__UO6NU';

  public static async clearContext(page: Page) {
    await page.waitForSelector(Poe.ClearSelector, { timeout: 10 * 60 * 1000 });
    await page.click(Poe.ClearSelector);
    // new chat
    await page.waitForSelector(
      '.SidebarLayout_sidebar__X_iwf > .ChatBotDetailsSidebar_contents__ScQ1s > .RightColumnBotInfoCard_sectionContainer___aFTN > .BotInfoCardActionBar_actionBar__WdCr7 > .Button_primary__pIDjn',
    );
    await page.click(
      '.SidebarLayout_sidebar__X_iwf > .ChatBotDetailsSidebar_contents__ScQ1s > .RightColumnBotInfoCard_sectionContainer___aFTN > .BotInfoCardActionBar_actionBar__WdCr7 > .Button_primary__pIDjn',
    );
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
    const useleft = account.use_left?.[req.model];
    if (useleft) {
      if (
        process.env.POE_USE_IGNORE_LEFT !== '1' &&
        useleft.daily + useleft.monthly === 0
      ) {
        this.logger.error(`pb ${account.pb} left 0`);
        stream.write(Event.error, { error: 'please retry later!' });
        stream.write(Event.done, { content: '' });
        stream.end();
        done(account);
        return;
      }
      if (useleft.daily) {
        useleft.daily -= 1;
      } else {
        useleft.monthly -= 1;
      }
      this.logger.info(
        `pb ${account.pb} ${req.model} left -> daily:[${useleft.daily}] monthly:[${useleft.monthly}]`,
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
      let et: EventEmitter;
      const tt = setTimeout(async () => {
        client.removeAllListeners('Network.webSocketFrameReceived');
        await Poe.clearContext(page);
        this.logger.info('poe try times > 3, return error');
        stream.write(Event.error, { error: 'please retry later!' });
        stream.write(Event.done, { content: '' });
        stream.end();
        account.failedCnt += 1;
        this.accountPool.syncfile();
        if (account.failedCnt >= MaxFailedTimes) {
          destroy();
          this.accountPool.syncfile();
          this.logger.info(`poe account failed cnt > 10, destroy ok`);
        } else {
          await page.reload();
          done(account);
        }
      }, 20 * 1000);
      let currMsgID = '';
      et = client.on('Network.webSocketFrameReceived', async ({ response }) => {
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
        if (!currMsgID && unique_id) {
          currMsgID = unique_id;
        }
        if (unique_id !== currMsgID) {
          // this.logger.info(`message id different`, {unique_id, currMsgID});
          return;
        }
        if (
          text.indexOf(
            `Sorry, you've exceeded your monthly usage limit for this bot`,
          ) !== -1
        ) {
          clearTimeout(tt);
          client.removeAllListeners('Network.webSocketFrameReceived');
          account.invalid = true;
          destroy(false);
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
            await Poe.clearContext(page);
            await sleep(2000);
            account.failedCnt = 0;
            this.accountPool.syncfile();
            done(account);
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
      await Poe.clearContext(page);
      await page.waitForSelector(Poe.InputSelector);
      await page.click(Poe.InputSelector);
      await page.type(Poe.InputSelector, `1`);
      this.logger.info('poe find input ok');
      const input = await page.$(Poe.InputSelector);
      //@ts-ignore
      await input?.evaluate((el, content) => (el.value = content), req.prompt);
      await page.keyboard.press('Enter');
      this.logger.info('send msg ok!');
    } catch (e: any) {
      client.removeAllListeners('Network.webSocketFrameReceived');
      this.logger.error(`account: pb=${account.pb}, poe ask stream failed:`, e);
      account.failedCnt += 1;
      if (account.failedCnt >= MaxFailedTimes) {
        destroy(true);
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
