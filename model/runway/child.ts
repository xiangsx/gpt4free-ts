import { ChildOptions, ComChild, DestroyOptions, Pool } from '../../utils/pool';
import {
  Account,
  GenVideoTaskReq,
  GenVideoTaskRes,
  GetVideoTaskRes,
  UploadsReq,
  UploadsRes,
} from './define';
import { AxiosError, AxiosInstance } from 'axios';
import {
  CreateNewAxios,
  CreateNewPage,
  getProxy,
} from '../../utils/proxyAgent';
import { Page, Protocol } from 'puppeteer';
import moment from 'moment';
import { loginGoogle, loginGoogleNew } from '../../utils/puppeteer';
import {
  ComError,
  downloadAndUploadCDN,
  downloadFile,
  parseCookie,
  parseJSON,
  randomStr,
  randomUserAgent,
  replaceLocalUrl,
  sleep,
  TimeFormat,
} from '../../utils';
import { Config } from '../../utils/config';
import { newLogger } from '../../utils/log';
import { AwsLambda } from 'elastic-apm-node/types/aws-lambda';
import fs from 'fs';
import { removeWatermarkFromVideo } from '../../utils/file';

export class Child extends ComChild<Account> {
  private _client?: AxiosInstance;
  private page!: Page;
  private proxy: string = this.info.proxy || getProxy();
  checkUsageTimer?: NodeJS.Timeout;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.logger = newLogger(label, { email: info.email });
  }

  get client() {
    if (!this._client) {
      this._client = CreateNewAxios(
        {
          baseURL: 'https://api.runwayml.com',
          timeout: 2 * 60 * 1000,
          headers: {
            referrer: 'https://app.runwayml.com/',
            origin: 'https://app.runwayml.com',
            'User-Agent': this.info.ua,
            Authorization: `Bearer ${this.info.token}`,
          },
        },
        {
          proxy: this.proxy,
          middleware: (v) => {
            const setCookies = v.headers['set-cookie'];
            if (!setCookies) {
              return v;
            }
            const sessionCookie = setCookies.find((v: string) =>
              v.includes('luma_session'),
            );
            if (!sessionCookie) {
              return v;
            }
            const { name, value, expires } = parseCookie(sessionCookie);
            if (!name || !value) {
              return v;
            }
            for (const v of this.info.cookies) {
              if (v.name === name) {
                v.value = value;
                v.expires = expires || -1;
              }
            }
            this.update({ cookies: this.info.cookies });
            this.logger.info('update luma_session');
            return v;
          },
          errorHandler: (err) => {
            this.logger.info(
              `axios error：${err.message}, req: ${JSON.stringify(
                err.config?.data,
              )} response: ${JSON.stringify(err.response?.data)}`,
            );
            if (err.message.indexOf('timeout') > -1) {
              this.destroy({ delMem: true, delFile: false });
            }
            if (err.message.indexOf('TLS connection') > -1) {
              this.logger.error('TLS connection error');
              this.update({ proxy: undefined });
              this.destroy({ delMem: true, delFile: false });
              return;
            }
            let res = err.response?.data as { error: string };
            if (res?.error) {
              if (res.error.indexOf('Jobs are limited') > -1) {
                this.update({ refresh_time: moment().add(1, 'd').unix() });
                this.destroy({ delMem: true, delFile: false });
                this.logger.info('Jobs are limited');
                return;
              }
              if (res.error.indexOf('enough credits') > -1) {
                this.update({ refresh_time: moment().add(1, 'month').unix() });
                this.destroy({ delMem: true, delFile: false });
                this.logger.info('Usage limit exceeded');
                return;
              }
            }
          },
        },
      );
    }
    return this._client;
  }

  async init() {
    if (!this.info.email) {
      throw new Error('email is required');
    }
    this.update({ destroyed: false });
    let page: Page;
    if (!this.info.token) {
      page = await CreateNewPage('https://app.runwayml.com/login', {
        simplify: true,
        recognize: false,
        proxy: this.proxy,
        protocolTimeout: 60 * 1000,
        navigationTimeout: 60 * 1000,
      });
      this.page = page;
      await sleep(10000);
      // click login
      setImmediate(async () => {
        await page.waitForSelector('button:nth-child(2)');
        await page.click('button:nth-child(2)');
      });
      await new Promise((resolve, reject) => {
        // 监听新创建的 target（可能是新标签或新窗口）
        const delay = setTimeout(
          () => reject(new Error('on targetcreated timeout')),
          30 * 1000,
        );
        page.browser().on('targetcreated', async (target) => {
          clearTimeout(delay);
          try {
            const newPage = await target.page();
            if (newPage) {
              console.log('新窗口/标签被创建');
              await newPage.waitForTimeout(1000); // 等待一会让页面加载
              console.log(await newPage.url()); // 输出新窗口的URL
              await loginGoogleNew(newPage, this.info).catch((e) => {
                this.logger.error(e.message);
              });
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      await sleep(10000);
      await this.checkLogin();
      await this.saveCookies();
      await this.saveToken();
      await this.saveTeamID();
      await this.saveUA();
      await page.browser().close();
    }
    this.update({ proxy: this.proxy });
    // await page.reload();
    // 保存cookies
    this.update({ failed: 0 });
  }

  get cookie() {
    return this.info.cookies.map((v) => `${v.name}=${v.value}`).join('; ');
  }

  async saveCookies() {
    const cookies = await this.page.cookies('https://app.runwayml.com');
    this.update({ cookies, proxy: this.proxy });
    this.logger.debug('saved cookies ok');
  }

  async saveUA() {
    const ua = await this.page.evaluate(() => navigator.userAgent.toString());
    this.update({ ua });
  }

  async checkLogin() {
    await this.page.waitForSelector(`button[data-testid="account-switcher"]`, {
      timeout: 10 * 1000,
    });
    this.logger.info('login success');
  }

  async saveToken() {
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('RW_USER_TOKEN');
    });
    if (!token) {
      throw new ComError('no token');
    }
    this.update({ token });
    this.logger.info('saved token ok');
  }

  async saveTeamID() {
    const team_id = await this.page.evaluate(() => {
      return parseInt(localStorage.getItem('rw__lastUsedTeamId') || '');
    });
    if (!team_id) {
      throw new ComError('no teamID');
    }
    this.update({ team_id });
    this.logger.info('saved team_id ok');
  }

  initFailed() {
    this.update({
      cookies: [],
      proxy: undefined,
      ua: undefined,
      failed: (this.info.failed || 0) + 1,
    });
    if (!this.info.email) {
      this.destroy({ delFile: true, delMem: true });
      return;
    }
    this.logger.error(`init failed, destroy, failed:${this.info.failed}`, {
      email: this.info.email,
    });
    this.destroy({ delFile: false, delMem: true });
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  async destroy(options?: DestroyOptions) {
    super.destroy(options);
    // await this.page
    //   .screenshot({ path: `run/error-${randomStr(20)}.png` })
    //   .catch((err) => this.logger.error(err.message));
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
    if (this.checkUsageTimer) {
      clearInterval(this.checkUsageTimer);
    }
  }

  async genTask(req: GenVideoTaskReq) {
    req.asTeamId = this.info.team_id;
    req.options.init_image = await this.autoUpload(req.options.init_image);
    const res = await this.client.post<GenVideoTaskRes>('/v1/tasks', req, {});
    return res.data;
  }

  async getTask(id: string) {
    const res = await this.client.get<GetVideoTaskRes>(`/v1/tasks/${id}`, {
      params: {
        asTeamId: this.info.team_id,
      },
    });
    if (res.data.task.artifacts?.[0]?.url) {
      let localUrl = await downloadAndUploadCDN(res.data.task.artifacts[0].url);
      if (
        res.data.task.options.watermark &&
        Config.config.runway?.remove_watermark
      ) {
        this.logger.info(`removing watermark: ${localUrl}`);
        localUrl = await removeWatermarkFromVideo(localUrl, 1150, 700, 100, 50);
      }
      res.data.task.artifacts[0].url = localUrl;
      this.logger.info(`video gen ok: ${localUrl}`);
    }
    if (res.data.task.artifacts?.[0]?.previewUrls?.length) {
      res.data.task.artifacts[0].previewUrls = await Promise.all(
        res.data.task.artifacts[0].previewUrls.map(downloadAndUploadCDN),
      );
    }
    return res.data;
  }

  async uploads(filename: string) {
    const req: UploadsReq = {
      filename,
      numberOfParts: 1,
      type: 'DATASET',
    };
    const res = await this.client.post<UploadsRes>('/v1/uploads', req);
    return res.data;
  }

  async upload(filepath: string, contentType: string, url: string) {
    const filestream = fs.readFileSync(filepath);
    const res = await this.client.put(url, filestream, {
      headers: {
        'Content-Type': contentType,
        Authorization: null,
      },
    });
    // 返回Etag
    return res.headers.etag;
  }

  async complete(id: string, ETag: string) {
    const res = await this.client.post<{ url: string }>(
      `/v1/uploads/${id}/complete`,
      {
        parts: [
          {
            PartNumber: 1,
            ETag,
          },
        ],
      },
    );
    return res.data.url;
  }

  async autoUpload(url: string) {
    const { file_name, outputFilePath } = await downloadFile(url);
    const uploadRes = await this.uploads(file_name);
    const ETag = await this.upload(
      outputFilePath,
      uploadRes.uploadHeaders['Content-Type'],
      uploadRes.uploadUrls[0],
    );
    const completeUrl = await this.complete(uploadRes.id, ETag);
    return completeUrl;
  }
}
