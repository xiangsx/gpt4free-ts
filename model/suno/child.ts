import { ComChild } from '../../utils/pool';
import {
  Account,
  BillInfo,
  Clip,
  CreateSongRes,
  SessionInfo,
  SongOptions,
} from './define';
import { AxiosInstance } from 'axios';
import { CreateNewAxios, CreateNewPage } from '../../utils/proxyAgent';
import FormData from 'form-data';
import { Page, Protocol } from 'puppeteer';
import moment from 'moment';
import { loginGoogle } from '../../utils/puppeteer';
import { decodeJwt, parseJSON, randomUserAgent, sleep } from '../../utils';

export class Child extends ComChild<Account> {
  private client!: AxiosInstance;
  private sessClient!: AxiosInstance;
  private page!: Page;

  async init() {
    if (!this.info.token) {
      throw new Error('email is required');
    }
    if (!this.info.ua) {
      this.update({ ua: randomUserAgent() });
    }
    this.sessClient = CreateNewAxios({
      baseURL: 'https://clerk.suno.ai',
      headers: {
        authority: 'clerk.suno.ai',
        'User-Agent': this.info.ua,
        Cookie: `__client=${this.info.token};`,
        pragma: 'no-cache',
        Origin: 'https://app.suno.ai',
        Referer: 'https://app.suno.ai/create/',
      },
    });
    await this.updateSID();
    await this.updateToken();
    await this.updateCredit();
    setInterval(async () => {
      try {
        await this.updateToken();
        await this.updateCredit();
      } catch (e) {
        this.destroy({ delMem: true, delFile: false });
      }
    }, 60 * 1000);
  }

  async updateSID() {
    let res: {
      data: {
        response: {
          sessions: { id: string }[];
        };
      };
    } = await this.sessClient.get('/v1/client?_clerk_js_version=4.70.5');
    const sid = res.data?.response?.sessions?.[0]?.id;
    if (!sid) {
      throw new Error('sid not found');
    }
    this.update({ sid });
    this.logger.info(`get sid:${sid}`);
  }

  async updateToken() {
    let res: { data: { jwt: string } } = await this.sessClient.post(
      `/v1/client/sessions/${this.info.sid}/tokens/api?_clerk_js_version=4.70.5`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://app.suno.ai',
          Referer: 'https://app.suno.ai/create/',
        },
      },
    );
    const jwt = res.data?.jwt;
    if (!jwt) {
      throw new Error('jwt not found');
    }
    this.client = CreateNewAxios({
      baseURL: 'https://studio-api.suno.ai/api/',
      headers: {
        authority: 'studio-api.suno.ai',
        Authorization: `Bearer ${jwt}`,
        'User-Agent': this.info.ua,
        Origin: 'https://app.suno.ai',
        Referer: 'https://app.suno.ai/create/',
      },
    });
    this.logger.info(`update token ok`);
  }

  async updateCredit() {
    const bill = await this.queryBill();
    this.update({ credit_left: bill.total_credits_left });
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
    const res: { data: CreateSongRes } = await this.client.post(
      '/generate/v2/',
      options,
    );
    return res.data;
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
    super.initFailed();
    if (this.page) {
      this.page.browser().close();
    }
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}
