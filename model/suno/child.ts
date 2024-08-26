import { ComChild, DestroyOptions } from '../../utils/pool';
import {
  Account,
  BillInfo,
  Clip,
  CreateSongRes,
  LyricTaskRes,
  SessionInfo,
  SongOptions,
  GetUploadTargetRes,
  GetUploadFileRes,
} from './define';
import { AxiosInstance } from 'axios';
import { CreateNewAxios, getProxy } from '../../utils/proxyAgent';
import { Page } from 'puppeteer';
import moment from 'moment';
import {
  ComError,
  downloadAndUploadCDN,
  downloadFile,
  randomUserAgent,
  sleep,
} from '../../utils';
import FormData from 'form-data';
import fs from 'fs';
import { getAudioDuration } from '../../utils/file';

export class Child extends ComChild<Account> {
  private client!: AxiosInstance;
  private sessClient!: AxiosInstance;
  itl?: NodeJS.Timer;
  proxy = this.info.proxy || getProxy();

  async init() {
    if (!this.info.token) {
      throw new Error('token is required');
    }
    if (!this.info.ua) {
      this.update({ ua: randomUserAgent() });
    }
    this.sessClient = CreateNewAxios(
      {
        baseURL: 'https://clerk.suno.com',
        headers: {
          'User-Agent': this.info.ua,
          Cookie: `__client=${this.info.token};`,
          pragma: 'no-cache',
          Origin: 'https://suno.com',
          Referer: 'https://suno.com/',
        },
        timeout: 30 * 1000,
      },
      {
        proxy: this.proxy,
      },
    );
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
    this.update({ proxy: this.proxy });
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
      this.logger.error(`sid not found, data: ${JSON.stringify(res.data)}`);
      this.update({ refresh_time: moment().add(1, 'h').unix() });
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
        timeout: 30 * 1000,
      },
      {
        proxy: this.proxy,
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
    if (bill.total_credits_left < 60) {
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
    const res: { data: { clips: Clip[] } } = await this.client.get('/feed/v2', {
      params: { ids: ids.join(',') },
    });
    return res.data;
  }

  async lyrics(prompt: string) {
    const res: { data: { id: string } } = await this.client.post(
      '/generate/lyrics/',
      {
        params: { prompt },
      },
    );
    if (!res.data.id) {
      throw new ComError(
        'lyrics not found',
        ComError.Status.InternalServerError,
      );
    }
    return res.data;
  }

  async lyricsTask(id: string) {
    const res = await this.client.get<LyricTaskRes>(`/generate/lyrics/${id}/`);
    return res.data;
  }

  async wholeSong(id: string) {
    const res = await this.client.post<Clip>('/generate/concat/v2/', {
      clip_id: id,
      is_infill: false,
    });
    return res.data;
  }

  async getUploadTarget(
    extension: string = 'mp3',
  ): Promise<GetUploadTargetRes> {
    const res = await this.client.post<GetUploadTargetRes>('/uploads/audio/', {
      extension,
    });
    return res.data;
  }

  async uploadFinish(id: string, file_name: string) {
    await this.client.post(`/uploads/audio/${id}/upload-finish/`, {
      upload_type: 'file_upload',
      upload_filename: 'Endless Love.mp3',
    });
  }

  async getUploadFileInfo(id: string): Promise<GetUploadFileRes> {
    const res = await this.client.get<GetUploadFileRes>(
      `/uploads/audio/${id}/`,
    );
    return res.data;
  }

  async initClip(id: string): Promise<string> {
    //https://studio-api.suno.ai/api/uploads/audio/780cfb42-b343-4c6c-8f7d-aafa781b0c6d/initialize-clip/
    const res = await this.client.post<{ clip_id: string }>(
      `/uploads/audio/${id}/initialize-clip/`,
    );
    return res.data.clip_id;
  }

  async setMetadata(clip_id: string, image_url: string, title: string) {
    // https://studio-api.suno.ai/api/gen/3a5480b7-d0ad-4fe8-89ae-208e23060f49/set_metadata/
    const res = await this.client.post<{ id: string; title: string }>(
      `/gen/${clip_id}/set_metadata/`,
      {
        image_url,
        is_audio_upload_tos_accepted: true,
        title,
      },
    );
    return res.data;
  }

  async uploadFile(file_url: string) {
    const localFile = await downloadAndUploadCDN(file_url);
    const { outputFilePath, file_name, ext, mime } = await downloadFile(
      localFile,
    );
    const target = await this.getUploadTarget(ext);
    const form = new FormData();
    for (const key in target.fields) {
      form.append(key, target.fields[key]);
    }
    form.append('file', fs.createReadStream(outputFilePath), {
      filename: file_name,
      contentType: mime,
    });
    const client = CreateNewAxios({}, { proxy: this.info.proxy });
    this.logger.info(JSON.stringify(form.getHeaders()));
    await client.post(target.url, form, {
      headers: {
        'User-Agent': this.info.ua,
        Origin: 'https://suno.com',
        Referer: 'https://suno.com/',
        ...form.getHeaders(),
      },
    });
    await this.uploadFinish(target.id, file_name);
    let uploadedFile: GetUploadFileRes | null = null;
    for (let i = 0; i < 10; i++) {
      uploadedFile = await this.getUploadFileInfo(target.id);
      if (uploadedFile.status === 'complete') {
        break;
      }
      await sleep(5 * 1000);
    }
    if (!uploadedFile || uploadedFile?.status !== 'complete') {
      throw new ComError(
        `upload file failed: ${uploadedFile?.error_message}`,
        ComError.Status.InternalServerError,
      );
    }
    const clip_id = await this.initClip(target.id);
    await this.setMetadata(
      clip_id,
      uploadedFile.image_url!,
      uploadedFile.title!,
    );
    const duration = await getAudioDuration(outputFilePath);
    return { clip_id, duration };
  }

  async queryBill() {
    let res: { data: BillInfo } = await this.client.get('/billing/info/', {});
    return res.data;
  }

  initFailed(e: any) {
    this.logger.error(`${this.proxy} init failed, err: ${e.message}`);
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
