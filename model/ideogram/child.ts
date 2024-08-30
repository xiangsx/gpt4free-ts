import { ChildOptions, ComChild, DestroyOptions } from '../../utils/pool';
import {
  Account,
  ClertAuth,
  ideogram,
  PredictionsReq,
  PredictionsRes,
  ResultRes,
} from './define';
import {
  CreateNewAxios,
  CreateNewPage,
  getProxy,
} from '../../utils/proxyAgent';
import { Page, Protocol } from 'puppeteer';
import moment from 'moment';
import {
  loginGoogle,
  loginGoogleNew,
  PuppeteerAxios,
  setPageInterception,
} from '../../utils/puppeteer';
import {
  downloadAndUploadCDN,
  ErrorData,
  Event,
  EventStream,
  parseJSON,
  randomUserAgent,
  retryFunc,
  sleep,
  uploadFile,
} from '../../utils';
import fs from 'fs';
import { Config } from '../../utils/config';

export class Child extends ComChild<Account> {
  private _client!: PuppeteerAxios;
  private page!: Page;
  private apipage!: Page;
  private ua: string = this.info.ua || randomUserAgent();
  private proxy: string = this.info.proxy || getProxy();
  private updateTimer: NodeJS.Timeout | null = null;
  private lastUseTime?: number;
  clert!: ClertAuth;

  constructor(
    private tmp: boolean,
    label: string,
    info: Account,
    options?: ChildOptions,
  ) {
    super(label, info, options);
  }

  get client() {
    if (!this._client) {
      this._client = new PuppeteerAxios(this.page, {
        baseURL: 'https://ideogram.ai/api',
        headers: {
          authority: 'ideogram.ai',
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          authorization: `Bearer ${this.info.token}`,
          origin: 'https://ideogram.ai',
          referer: 'https://ideogram.ai/t/explore',
        },
      });
    }
    return this._client;
  }

  async saveUA() {
    const ua = await this.page.evaluate(() => navigator.userAgent.toString());
    this.update({ ua });
    this.logger.info('ua saved ok');
  }

  async checkCreateProfile() {
    try {
      await this.page.waitForSelector('button.MuiButton-root', {
        timeout: 15000,
      });
      await this.page.click('button.MuiButton-root');
      this.logger.info('create profile');
    } catch (e) {
      this.logger.info('profile already created');
    }
  }

  async checkUsage() {
    const usage = await this.ImagesSamplingAvailable();
    this.update({ usage });
    const left =
      usage.max_creations_per_day - usage.num_standard_generations_today;
    if (!left || left <= 0) {
      this.update({ refresh_time: moment().add(1, 'day').unix() });
      throw new Error('not enough quota');
    }
    this.logger.info(`usage ${left}/${usage.max_creations_per_day}`);
  }

  async init() {
    if (!this.info.email) {
      throw new Error('email is required');
    }
    this.update({ destroyed: false });
    let page;
    page = await CreateNewPage('https://ideogram.ai/login', {
      proxy: this.proxy,
    });
    this.page = page;
    // click login
    await page.waitForSelector('.MuiButton-containedPrimary');
    await page.click('.MuiButton-containedPrimary');

    await loginGoogleNew(page, this.info);
    await this.checkCreateProfile();
    this.update({ proxy: this.proxy });
    await this.saveUA();
    await sleep(3 * 1000);
    await this.saveToken();
    await this.saveUserID();
    const av = await this.ImagesSamplingAvailable();
    await this.checkUsage();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    // @ts-ignore
    this.updateTimer = setInterval(async () => {
      this.checkUsage().catch(() => {
        this.destroy({ delFile: false, delMem: true });
      });
    }, 20 * 1000);
  }

  initFailed() {
    this.update({ proxy: undefined, ua: undefined, cookies: undefined });
    this.destroy({ delFile: false, delMem: true });
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  close() {
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
    this.logger.info('page closed');
  }

  get close_delay() {
    return Config.config.ideogram?.close_delay || 120;
  }

  async destroy(options?: DestroyOptions) {
    super.destroy(options);
    if (
      !this.lastUseTime ||
      moment().unix() - this.lastUseTime > this.close_delay
    ) {
      this.close();
    } else {
      this.logger.info('wait for close');
      setTimeout(() => {
        this.close();
      }, this.close_delay * 1000);
    }
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }

  async ImagesSample(req: ideogram.ImagesSampleReq) {
    req.user_id = this.info.uid;
    this.lastUseTime = moment().unix();
    return (
      await this.client.post<ideogram.ImagesSampleRes>(
        '/images/sample',
        req,
        {},
      )
    ).data;
  }

  async ImagesSamplingAvailable(model_version: string = 'V_0_2') {
    return (
      await this.client.get<ideogram.ImagesSamplingAvailableRes>(
        '/images/sampling_available_v2?model_version=V_0_2',
        {},
      )
    ).data;
  }

  async GalleryRetrieveRequests(request_ids: string[]) {
    const data = (
      await this.client.post<ideogram.GalleryRetrieveRes>(
        '/gallery/retrieve-requests',
        { request_ids },
        {},
      )
    ).data;
    if (data.sampling_requests[0].responses?.length) {
      this.logger.info('gen image ok');
      for (const v of data.sampling_requests[0].responses) {
        v.url = await this.downloadAndUploadCDN(v.response_id);
      }
    }
    return data;
  }

  async saveToken() {
    const data = (await this.page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('firebaseLocalStorageDb');

        request.onerror = (event) =>
          // @ts-ignore
          reject('IndexedDB error: ' + event.target.error);

        request.onsuccess = (event) => {
          // @ts-ignore
          const db = event.target.result;
          const transaction = db.transaction(
            ['firebaseLocalStorage'],
            'readonly',
          );
          const objectStore = transaction.objectStore('firebaseLocalStorage');

          const getRequest = objectStore.get(
            'firebase:authUser:AIzaSyBwq4bRiOapXYaKE-0Y46vLAw1-fzALq7Y:[DEFAULT]',
          );

          //@ts-ignore
          getRequest.onerror = (event) =>
            reject('Error getting data: ' + event.target.error);

          // @ts-ignore
          getRequest.onsuccess = (event) => {
            const data = event.target.result;
            resolve(data);
          };
        };
      });
    })) as { value: ideogram.User };
    if (!data?.value) {
      throw new Error('not found token');
    }
    this.update({
      token: data.value.stsTokenManager.accessToken,
      refresh_token: data.value.stsTokenManager.refreshToken,
      photo_url: data.value.photoURL,
    });
    this.logger.info('token saved ok');
  }

  async saveUserID() {
    const res = await this.Login(this.info.photo_url);
    this.update({ uid: res.user_model.user_id });
    this.logger.info(`uid[${this.info.uid}] saved ok`);
  }

  async GetRefreshToken(refreshToken: string) {
    const url =
      'https://securetoken.googleapis.com/v1/token?key=AIzaSyBwq4bRiOapXYaKE-0Y46vLAw1-fzALq7Y';

    const headers = {
      authority: 'securetoken.googleapis.com',
      accept: '*/*',
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://ideogram.ai',
      referer: 'https://ideogram.ai/',
      'user-agent': this.ua,
      'x-client-version': 'Chrome/JsCore/10.12.3/FirebaseCore-web',
    };

    const data = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };

    const response = await CreateNewAxios(
      {},
      { proxy: this.proxy },
    ).post<ideogram.TokenRefreshResponse>(url, new URLSearchParams(data), {
      headers,
    });
    return response.data;
  }

  async Login(external_photo_url: string) {
    const data = (
      await this.client.post<ideogram.LoginRes>(
        '/account/login',
        { external_photo_url },
        {},
      )
    ).data;
    return data;
  }

  async downloadAndUploadCDN(response_id: string) {
    const image_url = `https://ideogram.ai/assets/image/lossless/response/${response_id}`;
    if (!Config.config.ideogram?.save_cdn) {
      return image_url;
    }
    return retryFunc(
      async () => {
        const blobData = await this.page.evaluate((url) => {
          return new Promise((resolve, reject) => {
            fetch(url)
              .then((response) => response.blob())
              .then((blob) => blob.arrayBuffer())
              .then((arrayBuffer) => {
                const uint8Array = new Uint8Array(arrayBuffer);
                resolve(Array.from(uint8Array));
              })
              .catch((error) => reject(error));
          });
        }, image_url);
        const filepath = 'run/file/' + response_id + '.webp';
        fs.writeFileSync(filepath, Buffer.from(blobData as any));
        const url = await uploadFile(filepath);
        return url;
      },
      2,
      { defaultV: image_url },
    );
  }
}
