import { ComChild, DestroyOptions } from '../../utils/pool';
import { Account, extractSecretKey, getFireworksModel } from './define';
import {
  CreateNewAxios,
  CreateNewPage,
  getProxy,
} from '../../utils/proxyAgent';
import { Page } from 'puppeteer';
import moment from 'moment';
import { loginGoogle } from '../../utils/puppeteer';
import { ErrorData, Event, EventStream, parseJSON, sleep } from '../../utils';
import es from 'event-stream';
import { AxiosInstance } from 'axios';
import { Stream } from 'stream';
import { getModelConfig } from '../poe/define';
import { ModelType } from '../base';

export class Child extends ComChild<Account> {
  private client!: AxiosInstance;
  private page!: Page;
  private apipage!: Page;
  private proxy: string = this.info.proxy || getProxy();
  private updateTimer: NodeJS.Timeout | null = null;

  async saveCookies() {
    const cookies = await this.page.cookies();
    this.update({ cookies });
    this.logger.info('cookies saved ok');
  }

  async saveUA() {
    const ua = await this.page.evaluate(() => navigator.userAgent.toString());
    this.update({ ua });
  }

  async saveAPIKey() {
    await this.page.goto('https://fireworks.ai/account/api-keys');
    const v = await this.page.evaluate(() => {
      return Array.from(document.scripts)
        .map((v) => v.textContent)
        .find((v) => v && v.indexOf('apikey-default') > -1);
    });
    if (!v) {
      throw new Error('no apikey script');
    }
    const apikey = extractSecretKey(v);
    if (!apikey) {
      throw new Error('apikey not found');
    }
    this.update({ apikey });
    this.logger.info('apikey saved ok');
  }

  async checkChat() {
    const pt = new EventStream();
    const model = getFireworksModel(ModelType.Llama3_1_8b);
    try {
      await this.client.post('/v1/chat/completions', {
        model: model.id,
        messages: [
          {
            role: 'user',
            content: 'say 1',
          },
        ],
        temperature: 0.1,
        max_tokens: 2,
        top_p: 1,
        stream: false,
      });
      this.logger.info('check chat ok');
    } catch (e) {
      throw e;
    }
  }

  async askForStream(req: any, stream: EventStream) {
    const res = await this.client.post<Stream>('/v1/chat/completions', req, {
      responseType: 'stream',
    });
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
  }

  async init() {
    if (!this.info.email) {
      throw new Error('email is required');
    }
    let page;
    if (!this.info.apikey) {
      if (!this.info.cookies?.length) {
        page = await CreateNewPage('https://fireworks.ai/login', {
          proxy: this.proxy,
        });
        this.page = page;
        // click login
        await page.waitForSelector("button[type='submit']");
        await page.click("button[type='submit']");

        await loginGoogle(
          page,
          this.info.email,
          this.info.password,
          this.info.recovery,
        );
        await page.waitForNavigation({ timeout: 20 * 1000 }).catch((e) => {});
        await sleep(10000);
        this.logger.info(`login end, ${page.url()}`);
        if (
          page.url().indexOf('login') > -1 ||
          page.url().indexOf('logout') > -1
        ) {
          this.logger.info('try relogin');
          await page.waitForSelector("button[type='submit']");
          await page.click("button[type='submit']");
        }
      } else {
        page = await CreateNewPage('https://fireworks.ai', {
          proxy: this.proxy,
          cookies: this.info.cookies.map((v) => ({
            ...v,
            url: 'https://fireworks.ai/',
          })),
        });
        this.page = page;
      }
      await sleep(10000);
      this.update({ proxy: this.proxy });
      await this.saveUA();
      await this.saveCookies();
      await this.saveAPIKey();
      await this.page.close();
    }
    this.client = CreateNewAxios(
      {
        baseURL: 'https://api.fireworks.ai/inference',
        headers: {
          accept: 'text/event-stream',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
          authorization: `Bearer ${this.info.apikey}`,
          origin: 'https://fireworks.ai',
          priority: 'u=1, i',
          'user-agent': this.info.ua,
          'content-type': 'application/json',
        },
      },
      {
        proxy: this.proxy,
        errorHandler: (e) => {
          if (e.response?.status === 412) {
            this.logger.info('monthly limit exceeded');
            this.update({ refresh_time: moment().add(30, 'day').unix() });
            this.destroy({ delFile: false, delMem: true });
          }
        },
      },
    );
    await this.checkChat();
  }

  initFailed() {
    this.update({ proxy: undefined });
    this.destroy({ delFile: !this.info.email, delMem: true });
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }
}
