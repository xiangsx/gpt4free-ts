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
  sleep,
} from '../../utils';

export class Child extends ComChild<Account> {
  private _client!: PuppeteerAxios;
  private page!: Page;
  private apipage!: Page;
  private ua: string = this.info.ua || randomUserAgent();
  private proxy: string = this.info.proxy || getProxy();
  private updateTimer: NodeJS.Timeout | null = null;
  clert!: ClertAuth;

  constructor(
    private tmp: boolean,
    label: string,
    info: Account,
    options?: ChildOptions,
  ) {
    super(label, info, options);
  }

  get headers() {
    return {
      authority: 'ideogram.ai',
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9',
      authorization: `Bearer ${this.info.token}`,
      'content-type': 'application/json',
      origin: 'https://ideogram.ai',
      referer: 'https://ideogram.ai/t/explore',
      'user-agent': this.ua,
    };
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
          'content-type': 'application/json',
          origin: 'https://ideogram.ai',
          referer: 'https://ideogram.ai/t/explore',
        },
      });
    }
    return this._client;
  }

  async saveCookies() {
    const cookies = await this.page.cookies('https://ideogram.ai');
    const session_cookie = cookies.find((v) => v.name === 'session_cookie');
    if (!session_cookie) {
      throw new Error('not found cookies');
    }
    this.update({ cookies });
  }

  async getHeader() {
    if (!this.clert) {
      this.clert = new ClertAuth(
        'flux1.ai',
        this.info.cookies.find((v) => v.name === '__client')!.value,
        '5.14.0',
        this.info.ua!,
        this.proxy,
      );
    }
    const token = await this.clert.getToken();
    return {
      accept: '*/*',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
      origin: 'https://flux1.ai',
      priority: 'u=1, i',
      referer: 'https://flux1.ai/create',
      'user-agent': this.info.ua!,
      Cookie:
        `__client_uat=${moment().unix()}` +
        '; ' +
        this.info.sessCookies.map((v) => `${v.name}=${token}`).join('; '),
      'content-type': 'text/plain;charset=UTF-8',
    };
  }

  async saveUA() {
    const ua = await this.page.evaluate(() => navigator.userAgent.toString());
    this.update({ ua });
  }

  async chat(messages: string) {
    return (
      await this.client.post<{ data: string }>(
        '/chat',
        { messages },
        {
          headers: await this.getHeader(),
        },
      )
    ).data;
  }

  async predictions(req: PredictionsReq) {
    return (
      await this.client.post<PredictionsRes>('/predictions', req, {
        headers: await this.getHeader(),
      })
    ).data;
  }

  async result(id: string) {
    const { data } = await this.client.get<ResultRes>(`/result/${id}`, {
      headers: await this.getHeader(),
    });
    if (data.imgAfterSrc) {
      data.imgAfterSrc = await downloadAndUploadCDN(data.imgAfterSrc);
    }
    return data;
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
    if (left <= 0) {
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
    if (!this.info.cookies?.length) {
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
      await this.saveCookies();
      await sleep(3 * 1000);
    } else {
      page = await CreateNewPage('https://ideogram.ai/t/explore', {
        proxy: this.proxy,
        cookies: this.info.cookies.map((v) => ({
          ...v,
          url: 'https://ideogram.ai',
        })),
      });
      this.page = page;
      await this.saveUA();
      await this.saveCookies;
    }
    await this.saveToken();
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
    }, 10 * 1000);
  }

  initFailed() {
    this.update({ proxy: undefined });
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
    this.page
      ?.browser()
      .close()
      .catch((err) => this.logger.error(err.message));
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }

  async ImagesSample(req: ideogram.ImagesSampleReq) {
    return (
      await this.client.post<ideogram.ImagesSampleRes>('/images/sample', req, {
        headers: await this.getHeader(),
      })
    ).data;
  }

  async ImagesSamplingAvailable(model_version: string = 'V_0_2') {
    return (
      await this.client.get<ideogram.ImagesSamplingAvailableRes>(
        'https://ideogram.ai/api/images/sampling_available_v2?model_version=V_0_2',
        {},
      )
    ).data;
  }

  async saveToken() {
    // if (this.info.refresh_token) {
    //   const data = await this.GetRefreshToken(this.info.refresh_token);
    //   this.update({
    //     token: data.access_token,
    //     refresh_token: data.refresh_token,
    //   });
    //   this.logger.info('token saved ok');
    //   return;
    // }
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
    });
    this.logger.info('token saved ok');
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
}
