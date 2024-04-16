import { ComChild, DestroyOptions } from '../../utils/pool';
import {
  Account,
  DefaultPerEventReq,
  FocusType,
  ModelMap,
  PerAsk,
  PerAskMode,
  PerAskSearchFocus,
  PerEvents,
  PerMessageResponse,
  UserSettings,
} from './define';
import { Page } from 'puppeteer';
import { ChatRequest, ModelType } from '../base';
import { EventStream, randomUserAgent, sleep } from '../../utils';
import {
  CreateNewPage,
  CreateSocketIO,
  getProxy,
} from '../../utils/proxyAgent';
import { handleCF, ifCF } from '../../utils/captcha';
import { loginGoogle } from '../../utils/puppeteer';
import { Config } from '../../utils/config';
import { Socket } from 'socket.io-client';
import { v4 } from 'uuid';

export class Child extends ComChild<Account> {
  private page!: Page;
  private focusType: FocusType = FocusType.Writing;
  private cb?: (ansType: string, ansObj: any) => void;
  private refresh?: () => void;
  io!: Socket;
  proxy: string = this.info.proxy || getProxy();

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

  private async set(page: Page) {
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

  async setCopilot(open: boolean) {
    this.io.emit(PerEvents.SaveUserSettings, {
      ...DefaultPerEventReq,
      default_copilot: open,
    } as UserSettings);
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

  async initIO() {
    this.io = CreateSocketIO('wss://www.perplexity.ai', {
      proxy: this.proxy,
      extraHeaders: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        Cookie: (await this.page.cookies())
          .map((v) => `${v.name}=${v.value}`)
          .join('; '),
        Origin: 'https://www.perplexity.ai',
        'Sec-WebSocket-Version': '13',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
      },
    });

    await new Promise<void>((resolve, reject) => {
      this.io.on('connect', () => {
        this.logger.info('connect');
        resolve();
      });
      this.io.on('connect_error', (err) => {
        reject(err);
      });
    });
    this.io.on('disconnect', (reason, description) => {
      this.logger.error(`disconnect: ${reason} ${JSON.stringify(description)}`);
      this.destroy({ delFile: false, delMem: true });
    });
  }

  async updateVisitorID() {
    const cookies = await this.page.cookies('https://www.perplexity.ai');
    const visitor_id = cookies.find((v) => v.name === 'pplx.visitor-id')?.value;
    if (!visitor_id) {
      throw new Error('visitor_id is empty');
    }
    this.update({ visitor_id });
  }

  async init(): Promise<void> {
    if (!this.info.email) {
      throw new Error('email is empty');
    }
    let page: Page;
    if (!this.info.token) {
      page = await CreateNewPage('https://www.perplexity.ai', {
        recognize: false,
      });
      page = await handleCF(page);
      this.page = page;
      await page.waitForSelector('button.bg-super');
      await page.click('button.bg-super');

      await page.waitForSelector(
        'div:nth-child(2) > div > div:nth-child(1) > button:nth-child(1) > div > div',
      );
      await page.click(
        'div:nth-child(2) > div > div:nth-child(1) > button:nth-child(1) > div > div',
      );
      await loginGoogle(
        page,
        this.info.email,
        this.info.password,
        this.info.recovery,
      );
    } else {
      page = await CreateNewPage('https://www.perplexity.ai', {
        recognize: false,
        cookies: [
          {
            url: 'https://www.perplexity.ai',
            name: '__Secure-next-auth.session-token',
            value: this.info.token,
          },
        ],
      });
      page = await handleCF(page);
      this.page = page;
    }
    if (await ifCF(page)) {
      throw new Error('cf failed');
    }
    if (!(await this.isLogin(page))) {
      this.update({ invalid: true });
      throw new Error(`account:${this.info.id}, no login status`);
    }
    this.update({ proxy: this.proxy });
    if (Config.config.perauto?.model !== ModelType.GPT3p5Turbo) {
      if (!(await this.isPro(page))) {
        this.update({ invalid: true });
        this.logger.error(`account:${this.info.token}, not pro`);
        throw new Error('not pro');
      }
    }

    await this.initIO();
    await this.setCopilot(true);
    this.listenTokenChange();
  }

  initFailed() {
    super.initFailed();
    this.page
      ?.browser?.()
      .close?.()
      .catch((e) => this.logger.error(e.message));
  }

  async destroy(options?: DestroyOptions) {
    super.destroy(options);
    await sleep(2 * 60 * 1000);
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

  async askForStream(req: ChatRequest, stream: EventStream) {
    this.io.on('query_progress', (data: PerMessageResponse) => {});
    this.io.emit(PerEvents.PerplexityAsk, req.prompt, {
      version: '2.5',
      source: 'default',
      attachments: [],
      language: 'en-US',
      timezone: 'Asia/Shanghai',
      search_focus: PerAskSearchFocus.Writing,
      frontend_uuid: v4(),
      mode: PerAskMode.Concise,
      is_related_query: false,
      is_default_related_query: false,
      visitor_id: this.info.visitor_id,
      frontend_context_uuid: v4(),
      prompt_source: 'user',
      query_source: 'home',
    } as PerAsk);
  }
}
