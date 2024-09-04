import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { CDPSession, Page } from 'puppeteer';
import { ComError, Event, EventStream, parseJSON, sleep } from '../../utils';
import { Config } from '../../utils/config';
import { ComChild, ComInfo, DestroyOptions, Pool } from '../../utils/pool';
import { CreateNewPage } from '../../utils/proxyAgent';
import { handleCF, ifCF } from '../../utils/captcha';
import { v4 } from 'uuid';

type UseLeft = Partial<Record<ModelType, number>>;

enum FocusType {
  All = 1,
  Academic = 2,
  Writing = 3,
  Wolfram = 4,
  YouTube = 5,
  Reddit = 6,
}

const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT3p5Turbo]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(0)',
  [ModelType.GPT4TurboPreview]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(2)',
  [ModelType.Claude3Sonnet20240229]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(3)',
  [ModelType.Claude3Opus20240229]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(4)',
};

interface Account extends ComInfo {
  email?: string;
  login_time?: string;
  last_use_time?: string;
  token: string;
  failedCnt: number;
  invalid?: boolean;
  use_left?: UseLeft;
  model?: string;
}

class Child extends ComChild<Account> {
  private page!: Page;
  private focusType: FocusType = FocusType.Writing;
  private cb?: (ansType: string, ansObj: any) => void;
  private refresh?: () => void;
  private client!: CDPSession;

  async isLogin(page: Page) {
    try {
      await page.waitForSelector(this.UserName, { timeout: 5 * 1000 });
      return true;
    } catch (e: any) {
      return false;
    }
  }

  private InputSelector = 'textarea';
  private UserName = `a[href="/settings/account"]`;

  private async closeCopilot(page: Page) {
    try {
      await page.waitForSelector(
        '.text-super > .flex > div > .rounded-full > .relative',
        { timeout: 5 * 1000 },
      );
      await page.click('.text-super > .flex > div > .rounded-full > .relative');
    } catch (e) {
      this.logger.info('not need close copilot');
    }
  }

  async setModel(page: Page, model: ModelType) {
    try {
      await page.goto('https://www.perplexity.ai/settings');
      await page.waitForSelector(
        'div > div:nth-child(6) > div:nth-child(2) > div:nth-child(2) > span > button',
        { timeout: 3000 },
      );
      await page.click(
        'div > div:nth-child(6) > div:nth-child(2) > div:nth-child(2) > span > button',
      );
      const selector = ModelMap[model];
      if (!selector) {
        throw new Error('model not support');
      }
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.click(selector);
    } catch (e) {
      this.logger.error('set model failed', e);
    }
  }

  async listenTokenChange() {
    const page = this.page;
    const res = await page.waitForResponse(
      (res) => {
        const headers = res.headers();
        if (
          headers['set-cookie'] &&
          headers['set-cookie'].indexOf('__Secure-next-auth.session-token') > -1
        ) {
          return true;
        }
        return false;
      },
      { timeout: 24 * 60 * 60 * 1000 },
    );
    const headers = res.headers();
    const cookies = headers['set-cookie'].split(';');
    const token = cookies.find(
      (v) => v.indexOf('__Secure-next-auth.session-token') > -1,
    );
    if (!token) {
      throw new Error('get cookie failed');
    }
    const tokenValue = token.split('=')[1];
    this.update({ token: tokenValue });
    this.logger.info('update token ok');
    await this.listenTokenChange();
  }

  public async goHome() {
    const page = this.page;
    if (page.isClosed()) {
      return;
    }
    try {
      await page.waitForSelector('div:nth-child(1) > div > a > div > div', {
        timeout: 3000,
      });
      await page.click('div:nth-child(1) > div > a > div > div');
      await sleep(1000);
    } catch (e) {
      await page.goto('https://www.perplexity.ai');
      this.logger.error('go home failed', e);
    }
    await this.page.waitForSelector(this.InputSelector, {
      timeout: 3 * 1000,
    });
    await this.page.click(this.InputSelector);
  }

  public async changeMode(t: FocusType) {
    const page = this.page;
    if (page.isClosed()) {
      return false;
    }
    try {
      await page.waitForSelector('svg[data-icon="bars-filter"]', {
        timeout: 2 * 1000,
        visible: true,
      });
      await page.click('svg[data-icon="bars-filter"]');

      await sleep(100);
      const selector = `svg[data-icon="pencil"]`;
      await page.waitForSelector(selector, {
        timeout: 2 * 1000,
        visible: true,
      });
      await page.click(selector);
      return true;
    } catch (e: any) {
      this.logger.error(e.message);
      return false;
    }
  }

  async startListener() {
    const client = await this.page.target().createCDPSession();
    this.client = client;
    await client.send('Network.enable');
    const et = client.on(
      'Network.webSocketFrameReceived',
      async ({ response }) => {
        try {
          // 获取code
          const code = +response.payloadData.match(/\d+/)[0];
          this.logger.debug(response.payloadData);
          const dataStr = response.payloadData.replace(/\d+/, '').trim();
          if (!dataStr) {
            return;
          }
          const data = parseJSON(dataStr, []);
          if (data.length < 1) {
            return;
          }
          switch (code) {
            case 42:
              const [ansType, textObj] = data;
              const text = (textObj as any).text;
              const ansObj = parseJSON<{ answer: string; web_results: any[] }>(
                text,
                {
                  answer: '',
                  web_results: [],
                },
              );
              this.refresh?.();
              this.cb?.(ansType, ansObj);
              break;
            default:
              const [v] = data as { status: string }[];
              if (v.status) {
                this.cb?.(v.status, { answer: '', web_results: [] });
              }
              break;
          }
        } catch (e) {
          this.logger.warn('parse failed, ', e);
        }
      },
    );
    return client;
  }

  async sendMsg(
    t: FocusType,
    prompt: string,
    cb: (
      ansType: string,
      ansObj: { answer: string; web_results: any[]; query_str: string },
    ) => void,
    onTimeOut: () => void,
  ) {
    try {
      if (t !== this.focusType) {
        await this.changeMode(t);
        this.focusType = t;
      }
      const delay = setTimeout(() => {
        try {
          this.cb = undefined;
          if (!this.page.isClosed()) {
            this.goHome();
            this.changeMode(t);
          }
          clearTimeout(delay);
          onTimeOut();
        } catch (e) {
          this.logger.error('timeout failed, ', e);
        }
      }, 20 * 1000);
      this.cb = cb;
      await this.page.waitForSelector(this.InputSelector, {
        timeout: 3 * 1000,
      });
      await this.page.click(this.InputSelector);
      await this.client.send('Input.insertText', { text: prompt });
      this.logger.info('find input ok');
      await this.page.keyboard.press('Enter');
      this.logger.info('send msg ok!');
      this.refresh = () => delay.refresh();
      return async () => {
        this.cb = undefined;
        await this.goHome();
        await this.changeMode(t);
        clearTimeout(delay);
      };
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async init(): Promise<void> {
    if (!this.info.token) {
      throw new Error('token is empty');
    }
    let page = await CreateNewPage('https://www.perplexity.ai', {
      recognize: false,
      cookies: [
        {
          url: 'https://www.perplexity.ai',
          name: '__Secure-next-auth.session-token',
          value: this.info.token,
        },
      ],
    });
    this.page = page;
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    );
    page = await handleCF(page);
    this.page = page;
    if (await ifCF(page)) {
      throw new Error('cf failed');
    }
    if (!(await this.isLogin(page))) {
      this.update({ invalid: true });
      throw new Error(`account:${this.info.id}, no login status`);
    }
    if (Config.config.perplexity.model !== ModelType.GPT3p5Turbo) {
      if (!(await this.isPro(page))) {
        this.update({ invalid: true });
        this.logger.error(`account:${this.info.token}, not pro`);
        throw new Error('not pro');
      }
    }
    await this.closeCopilot(page);
    await this.setModel(
      page,
      Config.config.perplexity.model || ModelType.GPT3p5Turbo,
    );

    await this.startListener();
    this.logger.info('start listener ok');
    await this.goHome();
    this.logger.info('go home ok');
    await this.changeMode(this.focusType);
    this.logger.info('change mode ok');
    this.listenTokenChange();
  }

  initFailed() {
    super.initFailed();
    this.page
      ?.browser?.()
      .close?.()
      .catch((e) => this.logger.error(e.message));
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    if (!this.page.isClosed()) {
      this.page
        ?.browser?.()
        .close?.()
        .catch((e) => this.logger.error(e.message));
    }
  }

  async isPro(page: Page) {
    return (await page.$('.fill-super')) !== null;
  }
}

interface PerplexityChatRequest extends ChatRequest {
  retry?: number;
}

export class Perplexity extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.perplexity.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return true;
    },
    {
      delay: 2000,
      serial: () => Config.config.perplexity.serial || 1,
      preHandleAllInfos: async (allInfos) => {
        const infos: Account[] = [];
        const infoMap: Record<string, Account[]> = {};
        for (const v of allInfos) {
          if (!infoMap[v.token]) {
            infoMap[v.token] = [];
          }
          infoMap[v.token].push(v);
        }
        for (const v of Config.config.perplexity.tokens) {
          let vs: Account[] = [];
          if (infoMap[v]) {
            vs.push(...infoMap[v]);
          }
          vs.push(
            ...new Array(Config.config.perplexity.concurrency).fill(v).map(
              (token) =>
                ({
                  id: v4(),
                  ready: false,
                  token: token,
                } as Account),
            ),
          );
          vs = vs.slice(0, Config.config.perplexity.concurrency);
          infos.push(...vs);
        }
        return infos;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 3900;
      case ModelType.NetGPT4:
        return 3900;
      case ModelType.GPT3p5Turbo:
        return 3900;
      case ModelType.GPT4TurboPreview:
        return 3900;
      case ModelType.Claude3Opus20240229:
        return 3900;
      case ModelType.NetGpt3p5:
        return 3900;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    req.messages = req.messages.filter((v) => v.role !== 'system');
    const reqH = await super.preHandle(req, {
      token: false,
      countPrompt: true,
      forceRemove: true,
    });
    if (req.model.indexOf('claude') > -1) {
      reqH.prompt =
        reqH.messages
          .map(
            (v) =>
              `${v.role === 'assistant' ? 'Assistant' : 'Human'}: ${v.content}`,
          )
          .join('\n') + '\nAssistant: ';
    } else {
      reqH.prompt =
        reqH.messages.map((v) => `${v.role}_role: ${v.content}`).join('\n') +
        '\nassistant_role: ';
    }
    if (Config.config.perplexity.system) {
      reqH.prompt =
        Config.config.perplexity.system.replace(/\%s/g, req.model) +
        reqH.prompt;
    }
    return reqH;
  }

  public async askStream(req: PerplexityChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    let old = '';
    try {
      const end = await child.sendMsg(
        req.model.indexOf('net') > -1 ? FocusType.All : FocusType.Writing,
        req.prompt,
        async (ansType, ansObj) => {
          this.logger.debug(`recv msg ${ansType} ${ansObj}`);
          if (ansObj.query_str) {
            return;
          }
          try {
            switch (ansType) {
              case 'completed':
                child.update({ failedCnt: 0 });
                if (ansObj.answer.length > old.length) {
                  const newContent = ansObj.answer.substring(old.length);
                  for (let i = 0; i < newContent.length; i += 3) {
                    stream.write(Event.message, {
                      content: newContent.slice(i, i + 3),
                    });
                  }
                }
                stream.write(Event.done, { content: '' });
                stream.end();
                await end();
                child.release();
                this.logger.info('Recv msg ok');
                break;
              case 'query_progress':
                if (!old && ansObj.answer?.startsWith(':')) {
                  ansObj.answer = ansObj.answer.slice(1);
                }
                if (
                  ansObj.answer.length === 0 &&
                  (req.model === ModelType.NetGPT4 ||
                    req.model === ModelType.NetGpt3p5)
                ) {
                  stream.write(Event.message, {
                    content:
                      ansObj.web_results
                        .map((v) => `- [${v.name}](${v.url})`)
                        .join('\n') + '\n\n',
                  });
                }
                if (ansObj.answer.length > old.length) {
                  const newContent = ansObj.answer.substring(old.length);
                  for (let i = 0; i < newContent.length; i += 3) {
                    stream.write(Event.message, {
                      content: newContent.slice(i, i + 3),
                    });
                  }
                  old = ansObj.answer;
                }
            }
          } catch (e) {
            throw e;
          }
        },
        () => {
          stream.write(Event.error, { error: 'timeout' });
          stream.write(Event.done, { content: '' });
          stream.end();
          child.update({ failedCnt: child.info.failedCnt + 1 });
          if (child.info.failedCnt > 3) {
            child.destroy({ delFile: false, delMem: true });
          } else {
            child.release();
          }
        },
      );
    } catch (err: any) {
      child.update({ failedCnt: child.info.failedCnt + 1 });
      if (child.info.failedCnt > 5) {
        child.destroy({ delFile: false, delMem: true });
      } else {
        child.release();
      }
      throw new ComError(err.message, ComError.Status.BadRequest);
    }
  }
}
