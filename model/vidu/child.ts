import { ComChild, DestroyOptions, Pool } from '../../utils/pool';
import {
  Account,
  CreditsRes,
  Task,
  TaskReq,
  TaskRes,
  TaskStateProcess,
} from './define';
import { AxiosInstance } from 'axios';
import {
  CreateNewAxios,
  CreateNewPage,
  getProxy,
} from '../../utils/proxyAgent';
import { Page, Protocol } from 'puppeteer';
import moment from 'moment';
import { loginGoogle } from '../../utils/puppeteer';
import { ComError, parseJSON, sleep, TimeFormat } from '../../utils';
import { Stream } from 'stream';
import es from 'event-stream';

export class Child extends ComChild<Account> {
  private client!: AxiosInstance;
  private page!: Page;
  private proxy: string = this.info.proxy || getProxy();
  checkUsageTimer?: NodeJS.Timeout;

  async init() {
    if (!this.info.email) {
      throw new Error('email is required');
    }
    this.update({ destroyed: false });
    let page;
    if (!this.info.cookies?.length) {
      page = await CreateNewPage('https://www.vidu.studio/login', {
        recognize: false,
        proxy: this.proxy,
      });
      this.page = page;
      // click login
      await page.waitForSelector('button:nth-child(1)');
      await page.click('button:nth-child(1)');
      await loginGoogle(
        page,
        this.info.email,
        this.info.password,
        this.info.recovery,
      );
      await sleep(3000);
      await this.checkLogin();
      await this.saveCookies();
      await this.saveUA();
      await page.browser().close();
    } else if (!this.info.ua || !this.info.proxy) {
      page = await CreateNewPage('https://www.vidu.studio/', {
        recognize: false,
        proxy: this.proxy,
        cookies: this.info.cookies.map((v) => ({
          ...v,
          url: 'https://www.vidu.studio/',
        })),
      });
      this.page = page;
      await sleep(3000);
      await this.checkLogin();
      await this.saveCookies();
      await this.saveUA();
      await page.browser().close();
    }
    // await page.reload();
    // 保存cookies
    this.client = CreateNewAxios(
      {
        baseURL: 'https://api.vidu.studio',
        timeout: 2 * 60 * 1000,
        headers: {
          referrer: 'https://www.vidu.studio/',
          origin: 'https://www.vidu.studio',
          'User-Agent': this.info.ua,
          Cookie: this.cookie,
        },
      },
      {
        proxy: this.proxy,
        errorHandler: (err) => {
          this.logger.info(
            `axios error：${err.message}, res: ${JSON.stringify(
              err.response?.data,
            )}, req: ${JSON.stringify(err.config?.data)}`,
          );
          if (err.response?.status === 403) {
            this.update({ refresh_time: moment().add(1, 'month').unix() });
            this.destroy({ delFile: false, delMem: true });
            return;
          }
          if (err.message.indexOf('timeout') > -1) {
            this.destroy({ delMem: true, delFile: false });
          }
          // @ts-ignore
          if (err.response?.data?.detail?.indexOf?.('Not authenticated') > -1) {
            this.update({
              cookies: [],
            });
            this.destroy({ delMem: true, delFile: false });
            this.logger.info('account not authenticated');
            return;
          }
          if (
            // @ts-ignore
            err.response?.data?.detail?.indexOf?.(
              'Maximum concurrent usage limit exceeded',
            ) > -1
          ) {
            this.update({ refresh_time: moment().add(20, 'minute').unix() });
            this.destroy({ delMem: true, delFile: false });
            this.logger.info('Maximum concurrent usage limit exceeded');
            return;
          }
          if (
            // @ts-ignore
            err.response?.data?.detail?.indexOf?.(
              'Usage limit exceeded for this month',
            ) > -1
          ) {
            this.update({ refresh_time: moment().add(1, 'month').unix() });
            this.destroy({ delMem: true, delFile: false });
            this.logger.info('Usage limit exceeded for this month');
            return;
          }
          if (
            // @ts-ignore
            err.response?.data?.detail?.indexOf?.(
              'Maximum daily generation limit reached',
            ) > -1
          ) {
            this.update({ refresh_time: moment().add(1, 'day').unix() });
            this.destroy({ delMem: true, delFile: false });
          }
        },
      },
    );
    await this.checkCredits();
    // @ts-ignore
    this.checkUsageTimer = setInterval(() => {
      this.checkCredits().catch((err) => {
        this.logger.error(err.message);
      });
    }, 60 * 1000);
  }

  get cookie() {
    return this.info.cookies.map((v) => `${v.name}=${v.value}`).join('; ');
  }

  async tasks(req: TaskReq) {
    const res = await this.client.post<TaskRes>('/vidu/v1/tasks', req);
    return res.data;
  }

  async taskState(id: string) {
    const res = await this.client.get<Stream>(`/vidu/v1/tasks/state?id=${id}`, {
      responseType: 'stream',
    });
    return res.data;
  }

  async listenTaskState(
    id: string,
    onChange: (v: TaskStateProcess) => void,
    onEnd: () => void,
  ) {
    const pt = await this.taskState(id);
    pt.pipe(es.split(/\r?\n\r?\n/)).pipe(
      es.map(async (chunk: any, cb: any) => {
        const res = chunk.toString();
        if (!res) {
          return;
        }
        const dataStr = res.replace('data: ', '');
        const data = parseJSON<undefined | TaskStateProcess>(
          dataStr,
          undefined,
        );
        cb(null, data);
      }),
    );
    pt.on('data', onChange);
    pt.on('close', onEnd);
  }

  async credits() {
    const res = await this.client.get<CreditsRes>('/credit/v1/credits/me');
    return res.data;
  }

  async saveCookies() {
    const cookies = await this.page.cookies('https://www.vidu.studio/');
    const token = cookies.find((v) => v.name === 'JWT')?.value;
    if (!token) {
      throw new ComError('no access_token');
    }
    this.update({ cookies, proxy: this.proxy });
    this.logger.debug('saved cookies ok');
  }

  async saveUA() {
    const ua = await this.page.evaluate(() => navigator.userAgent.toString());
    this.update({ ua });
  }

  async checkLogin() {
    await this.page.goto('https://www.vidu.studio/create');
    await this.page.waitForSelector('#viduUserCreateUpload', {
      timeout: 10 * 1000,
    });
    this.logger.info('login success');
  }

  initFailed() {
    super.initFailed();
    if (this.page) {
      this.update({ cookies: [], proxy: undefined });
      this.page.browser().close();
    }
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
    if (this.checkUsageTimer) {
      clearInterval(this.checkUsageTimer);
    }
  }

  static GetClient(pool: Pool<Account, Child>, id: string) {
    const info = pool.findOne((v) => v.id === id);
    if (!info?.cookies) {
      throw new ComError('cookies not found', ComError.Status.Unauthorized);
    }
    const client = CreateNewAxios(
      {
        baseURL: 'https://api.vidu.studio',
        timeout: 2 * 60 * 1000,
        headers: {
          referrer: 'https://www.vidu.studio/',
          origin: 'https://www.vidu.studio',
          'User-Agent': info.ua,
          Cookie: info.cookies.map((v) => `${v.name}=${v.value}`).join('; '),
        },
      },
      {
        proxy: info.proxy,
      },
    );
    return client;
  }

  static async TaskState(
    pool: Pool<Account, Child>,
    server_id: string,
    id: string,
  ) {
    const client = this.GetClient(pool, server_id);
    const res = await client.get<Stream>(`/vidu/v1/tasks/state?id=${id}`, {
      responseType: 'stream',
    });
    return res.data;
  }

  static async History(pool: Pool<Account, Child>, server_id: string) {
    const client = this.GetClient(pool, server_id);
    const res = await client.get<{ tasks: Task[]; total: number }>(
      '/vidu/v1/tasks/history/me?pager.page=0&pager.pagesz=10',
    );
    return res.data;
  }

  static async HistoryOne(
    pool: Pool<Account, Child>,
    server_id: string,
    id: string,
  ) {
    const history = await this.History(pool, server_id);
    const v = history.tasks.find((v) => v.id === id);
    if (!v) {
      throw new ComError(`task ${id} not found`);
    }
    return v;
  }

  async checkCredits() {
    this.update({ credits: await this.credits() });
    if (this.info.credits!.credits <= 0) {
      this.update({ refresh_time: moment().add(1, 'month').unix() });
      this.destroy({ delMem: true, delFile: false });
      throw new ComError('usage limit');
    }
    this.logger.info(`get usage success, ${this.info.credits!.credits}`);
  }
}
