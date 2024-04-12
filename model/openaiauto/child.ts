import { ComChild } from '../../utils/pool';
import {
  Account,
  MessagesParamsList,
  MessagesReq,
  OpenaiError,
} from './define';
import { ComError } from '../../utils';
import { CreateNewAxios, downloadImageToBase64 } from '../../utils/proxyAgent';
import { AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import moment from 'moment';

export class Child extends ComChild<Account> {
  public client = CreateNewAxios(
    {
      baseURL: 'https://api.openai.com/',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
        Authorization: `Bearer ${this.info.apikey}`,
      },
      timeout: 30 * 1000,
    } as CreateAxiosDefaults,
    {
      proxy: true,
    },
  );

  async init(): Promise<void> {
    try {
      if (!this.info.apikey) {
        throw new Error('apikey empty');
      }
      await this.checkChat();
    } catch (err: any) {
      this.logger.error(
        `init error: ${err.message} ${JSON.stringify(err.response?.data)}`,
      );

      throw err;
    }
  }

  initFailed(e?: any) {
    if (e.response?.data) {
      this.handleError(e.response?.data);
      return;
    }
    super.initFailed(e);
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  async checkChat() {
    const res = await this.client.post('/v1/embeddings', {
      input: 'say 1',
      model: 'text-embedding-ada-002',
      encoding_format: 'float',
    });
    if (res.data.error) {
      throw new ComError(JSON.stringify(res.data));
    }
    this.logger.info('check chat ok');
  }

  errHandler: [(e: OpenaiError) => boolean, (e: OpenaiError) => void][] = [
    [
      (e) => e.error.message.indexOf('requests per min') > -1,
      () => {
        this.update({ refresh_unix: moment().add(20, 's').unix() });
        this.destroy({ delFile: false, delMem: true });
      },
    ],
    [
      (e) => e.error.message.indexOf('requests per day') > -1,
      () => {
        this.update({ refresh_unix: moment().add(30, 'm').unix() });
        this.destroy({ delFile: false, delMem: true });
      },
    ],
    [
      (e) => e.error.message.indexOf('You exceeded your current quota') > -1,
      () => {
        this.update({ low_credit: true });
        this.destroy({ delFile: false, delMem: true });
      },
    ],
    [
      (e) => e.error.message.indexOf('Incorrect API key provided') > -1,
      () => {
        this.update({ banned: true });
        this.destroy({ delFile: false, delMem: true });
      },
    ],
  ];

  async handleError(e: { error: { message: string } }) {
    for (const [check, handler] of this.errHandler) {
      if (check(e)) {
        handler(e);
        return;
      }
    }
    this.destroy({ delFile: false, delMem: true });
    this.logger.error(e.error.message);
  }
}
