import { ComChild, DestroyOptions } from '../../utils/pool';
import {
  Account,
  BillInfo,
  Clip,
  CreateSongRes,
  SessionInfo,
  SongOptions,
} from './define';
import { AxiosInstance } from 'axios';
import { CreateNewAxios } from '../../utils/proxyAgent';
import { Page } from 'puppeteer';
import moment from 'moment';
import { randomUserAgent } from '../../utils';

export class Child extends ComChild<Account> {
  private client!: AxiosInstance;
  private sessClient!: AxiosInstance;
  itl?: NodeJS.Timer;

  async init() {
    if (!this.info.token) {
      throw new Error('token is required');
    }
    if (!this.info.ua) {
      this.update({ ua: randomUserAgent() });
    }
    this.sessClient = CreateNewAxios({
      baseURL: 'https://clerk.suno.com',
      headers: {
        authority: 'clerk.suno.com',
        'User-Agent': this.info.ua,
        Cookie: `__client=${this.info.token};`,
        pragma: 'no-cache',
        Origin: 'https://suno.com',
        Referer: 'https://suno.com/create/',
      },
    });
    await this.updateSID();
    await this.updateToken();
    await this.updateCredit();
    this.itl = setInterval(async () => {
      try {
        await this.updateToken();
        await this.updateCredit();
      } catch (e) {
        this.destroy({ delMem: true, delFile: false });
      }
    }, 50 * 1000);
  }

  async updateSID() {
    let res: {
      data: {
        response: {
          sessions: { id: string }[];
        };
      };
    } = await this.sessClient.get(
      '/v1/client?_clerk_js_version=4.72.0-snapshot.vc141245',
    );
    const sid = res.data?.response?.sessions?.[0]?.id;
    if (!sid) {
      throw new Error('sid not found');
    }
    this.update({ sid });
    this.logger.info(`get sid:${sid}`);
  }

  async updateToken() {
    let res: { data: { jwt: string } } = await this.sessClient.post(
      `/v1/client/sessions/${this.info.sid}/tokens/api?_clerk_js_version=4.72.0-snapshot.vc141245`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://suno.com',
          Referer: 'https://suno.com/create/',
        },
      },
    );
    const jwt = res.data?.jwt;
    if (!jwt) {
      throw new Error('jwt not found');
    }
    this.client = CreateNewAxios(
      {
        baseURL: 'https://studio-api.suno.ai/api/',
        headers: {
          authority: 'studio-api.suno.ai',
          Authorization: `Bearer ${jwt}`,
          'User-Agent': this.info.ua,
          Origin: 'https://suno.com',
          Referer: 'https://suno.com/',
        },
      },
      {
        errorHandler: (err) => {
          this.logger.error(
            `client error:${JSON.stringify({
              message: err.message,
              data: err?.response?.data,
              status: err.status,
            })}`,
          );
          if (err.message.indexOf('401') > -1) {
            this.destroy({ delFile: false, delMem: true });
          }
        },
      },
    );
    this.logger.info(`update token ok`);
  }

  async updateCredit() {
    const bill = await this.queryBill();
    this.update({ credit_left: bill.total_credits_left });
    if (bill.total_credits_left < 10) {
      this.update({ refresh_time: moment().add(1, 'd').unix() });
      throw new Error(`credit left:${bill.total_credits_left} not enough`);
    }
    this.logger.info(`update credit ok: ${bill.total_credits_left}`);
  }

  async querySession() {
    let res: { data: SessionInfo } = await this.client.get('/session/', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  }

  async createSong(options: SongOptions) {
    options.prompt =
      options.prompt?.slice(0, options.mv.indexOf('3-5') > -1 ? 2500 : 1250) ||
      '';
    try {
      const res: { data: CreateSongRes } = await this.client.post(
        '/generate/v2/',
        options,
        { timeout: 5 * 1000 },
      );
      return res.data;
    } catch (e: any) {
      if (e.message.indexOf('timeout') > -1) {
        this.destroy({ delMem: true, delFile: false });
        throw new Error('timeout');
      }
      if (e.response?.status === 402) {
        this.update({ need_pay: true });
        this.destroy({ delMem: true, delFile: false });
        throw new Error('account credits use out, need pay');
      }
      throw e;
    }
  }

  async feedSong(ids: string[]) {
    const res: { data: Clip[] } = await this.client.get(
      'https://studio-api.suno.ai/api/feed/',
      {
        params: { ids: ids.join(',') },
      },
    );
    return res.data;
  }

  async queryBill() {
    let res: { data: BillInfo } = await this.client.get('/billing/info/', {});
    return res.data;
  }

  initFailed(e: any) {
    this.logger.error(e.message);
    if (e?.response?.status === 401) {
      this.update({ credit_left: 0 });
      this.destroy({ delMem: true, delFile: false });
      return;
    }
    this.destroy({ delMem: true, delFile: !this.info.token });
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
  destroy(options?: DestroyOptions) {
    super.destroy(options);
    if (this.itl) {
      this.logger.debug('clear update token timer');
      // @ts-ignore
      clearInterval(this.itl);
    }
  }
}
