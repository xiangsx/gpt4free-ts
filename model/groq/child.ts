import { ComChild, DestroyOptions, Pool } from '../../utils/pool';
import { Account, ProfileRes } from './define';
import {
  CreateNewPage,
  getProxy,
  WebFetchWithPage,
} from '../../utils/proxyAgent';
import { Page, Protocol } from 'puppeteer';
import moment from 'moment';
import { loginGoogle } from '../../utils/puppeteer';
import {
  ComError,
  ErrorData,
  Event,
  EventStream,
  parseJSON,
  sleep,
} from '../../utils';
import es from 'event-stream';
import { ModelType } from '../base';

export class Child extends ComChild<Account> {
  private client!: WebFetchWithPage;
  private page!: Page;
  private apipage!: Page;
  private proxy: string = this.info.proxy || getProxy();
  private updateTimer: NodeJS.Timeout | null = null;

  async saveCookies() {
    const cookies = await this.page.cookies();
    const token = cookies.find((v) => v.name === 'stytch_session_jwt');
    if (!token) {
      throw new ComError('token not found');
    }
    this.update({ cookies });
    this.logger.info('cookies saved ok');
  }

  get token() {
    return this.info.cookies?.find((v) => v.name === 'stytch_session_jwt')
      ?.value;
  }

  async saveUA() {
    const ua = await this.page.evaluate(() => navigator.userAgent.toString());
    this.update({ ua });
  }

  async fetch<T>(path: string, requestInit: RequestInit): Promise<T> {
    const res = (await this.apipage.evaluate(
      (token, path, requestInit) => {
        return new Promise((resolve) => {
          fetch(`https://api.groq.com${path}`, {
            headers: {
              accept: 'application/json',
              'accept-language':
                'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
              priority: 'u=1, i',
              'x-groq-keep-alive-pings': 'true',
              'x-stainless-arch': 'unknown',
              'x-stainless-lang': 'js',
              'x-stainless-os': 'Unknown',
              'x-stainless-package-version': '0.4.0',
              'x-stainless-runtime': 'browser:chrome',
              'x-stainless-runtime-version': '126.0.0',
            },
            referrer: `https://groq.com/`,
            body: null,
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            ...requestInit,
          })
            .then((res) => {
              return res.text();
            })
            .then((data) => {
              resolve(data);
            })
            .catch((error) => {
              resolve(null);
            });
        });
      },
      this.token,
      path,
      requestInit,
    )) as string;
    const data = parseJSON<T | null>(res, null);
    if (!data) {
      throw new Error(`groq fetch failed: ${res}`);
    }
    return data;
  }

  async saveOrgID() {
    const res = await this.fetch<ProfileRes>('/platform/v1/user/profile', {});
    const org_id = res.user.orgs.data[0]?.id;
    if (!org_id) {
      throw new Error('org_id not found');
    }
    this.update({ org_id });
    this.logger.info('org_id saved ok');
  }

  async checkChat() {
    const pt = new EventStream();
    await new Promise(async (resolve, reject) => {
      try {
        await this.askForStream(
          {
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'say 1',
              },
            ],
            temperature: 0.2,
            max_tokens: 2048,
            top_p: 1,
            stream: true,
          },
          pt,
        );
        pt.read(
          (event, data) => {
            if (event === Event.error) {
              reject(new Error((data as ErrorData).error));
            }
            if (event === Event.done) {
              resolve(null);
            }
          },
          () => {
            resolve(null);
          },
        );
      } catch (e) {
        reject(e);
      }
    });
    this.logger.info('check chat ok');
  }

  async askForStream(req: any, stream: EventStream) {
    try {
      const res = await this.client.fetch('/openai/v1/chat/completions', {
        body: JSON.stringify(req),
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
          'groq-app': 'chat',
          'groq-organization': this.info.org_id,
          priority: 'u=1, i',
          'sec-ch-ua':
            '"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'x-groq-keep-alive-pings': 'true',
          'x-stainless-arch': 'unknown',
          'x-stainless-lang': 'js',
          'x-stainless-os': 'Unknown',
          'x-stainless-package-version': '0.4.0',
          'x-stainless-runtime': 'browser:chrome',
          'x-stainless-runtime-version': '126.0.0',
        },
        referrer: 'https://groq.com/',
        referrerPolicy: 'strict-origin-when-cross-origin',
        mode: 'cors',
        credentials: 'include',
      });
      res.pipe(es.split(/\r?\n\r?\n/)).pipe(
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
      res.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      if (e.message.indexOf('restricted') > -1) {
        this.logger.info('org restricted');
        this.update({ refresh_time: moment().add(30, 'day').unix() });
        this.destroy({ delFile: false, delMem: true });
        throw e;
      }
      throw e;
    }
  }

  async init() {
    if (!this.info.email) {
      throw new Error('email is required');
    }
    this.update({ destroyed: false });
    let page;
    if (!this.info.cookies?.length) {
      page = await CreateNewPage('https://groq.com/', {
        proxy: this.proxy,
      });
      this.page = page;
      // click login
      await page.waitForSelector(
        'body > footer > div > div > button:nth-child(2)',
      );
      await page.click('body > footer > div > div > button:nth-child(2)');
      await page.waitForSelector(
        "div[role='dialog'] > div > div > div > button",
      );
      await page.click("div[role='dialog'] > div > div > div > button");

      await loginGoogle(
        page,
        this.info.email,
        this.info.password,
        this.info.recovery,
      );
    } else {
      page = await CreateNewPage('https://groq.com/', {
        proxy: this.proxy,
        cookies: this.info.cookies.map((v) => ({
          ...v,
          url: 'https://groq.com/',
        })),
      });
      this.page = page;
    }
    await sleep(3000);
    this.update({ proxy: this.proxy });
    await this.saveCookies();
    this.apipage = await this.page.browser().newPage();
    await this.apipage.goto('https://api.groq.com/');
    await this.saveUA();
    await this.saveOrgID();
    // await page.reload();
    // 保存cookies
    this.client = new WebFetchWithPage(this.apipage);
    await this.checkChat();
    // @ts-ignore
    this.updateTimer = setInterval(async () => {
      await this.page.reload();
      await this.saveCookies();
    }, 60 * 1000);
  }

  initFailed() {
    this.update({ cookies: [], proxy: undefined });
    this.destroy({ delFile: false, delMem: true });
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
