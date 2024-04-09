import { ComChild, DestroyOptions } from '../../utils/pool';
import { Account, FocusType, ModelMap } from './define';
import { CDPSession, Page } from 'puppeteer';
import { ModelType } from '../base';
import { parseJSON, sleep } from '../../utils';
import { CreateNewPage } from '../../utils/proxyAgent';
import { handleCF, ifCF } from '../../utils/captcha';
import { loginGoogle } from '../../utils/puppeteer';
import { Config } from '../../utils/config';

export class Child extends ComChild<Account> {
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
      await sleep(1000);
      const selector = ModelMap[model];
      if (!selector) {
        throw new Error('model not support');
      }
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.click(selector);
      this.logger.info('set model ok');
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
    if (Config.config.perauto?.model !== ModelType.GPT3p5Turbo) {
      if (!(await this.isPro(page))) {
        this.update({ invalid: true });
        this.logger.error(`account:${this.info.token}, not pro`);
        throw new Error('not pro');
      }
    }
    await this.closeCopilot(page);
    await this.setModel(
      page,
      Config.config.perauto?.model || ModelType.GPT3p5Turbo,
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
