import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  getRandomOne,
  parseJSON,
  randomStr,
  sleep,
} from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateAxiosProxy, CreateNewPage, WSS } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import { CreateEmail } from '../../utils/emailFactory';
import { Page } from 'puppeteer';
import { loginGoogle } from '../../utils/puppeteer';

const APP_KEY = 'af9e46318302fccfc6db';
const APP_CLUSTER = 'mt1';

interface Account extends ComInfo {
  email: string;
  password: string;
  recovery_mail: string;
  company_name: string;
  app_name: string;
  app_uuid: string;
  api_key: string;
  left: number;
  failed_times: number;
}
class Child extends ComChild<Account> {
  public client!: AxiosInstance;
  public ws!: WSS;
  private channelMap: Record<
    string,
    ((event: string, data: string) => void) | null
  > = {};
  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  public setMsgListener(cb: (event: string, data: string) => void) {
    for (const channel in this.channelMap) {
      if (!this.channelMap[channel]) {
        this.channelMap[channel] = cb;
        return channel;
      }
    }
    const channel = v4();
    this.ws.send(
      JSON.stringify({
        event: 'pusher:subscribe',
        data: {
          auth: '',
          channel: `public-${channel}`,
        },
      }),
    );
    this.channelMap[channel] = cb;
    return channel;
  }

  public removeMsgListener(channel: string) {
    this.channelMap[channel] = null;
  }

  async init(): Promise<void> {
    try {
      if (!this.info.api_key) {
        const page = await CreateNewPage(
          'https://app.airops.com/users/sign_up',
        );
        await page.waitForSelector(
          '.min-h-screen > .rounded-lg > .mt-8 > form > .inline-flex',
        );
        await page.click(
          '.min-h-screen > .rounded-lg > .mt-8 > form > .inline-flex',
        );

        const gmail = getRandomOne(Config.config.gmail_list);
        await loginGoogle(
          page,
          gmail.email,
          gmail.password,
          gmail.recovery_email,
        );
        this.update({
          email: gmail.email,
          password: gmail.password,
          recovery_mail: gmail.recovery_email,
        });
        this.logger.info('login google ok');
        await sleep(3000);
        const company_name = randomStr(10);
        await page.waitForSelector('#companyName');
        await page.click('#companyName');
        await page.keyboard.type(company_name);
        this.update({ company_name });

        await page.waitForSelector('#role');
        await page.click('#role');

        await page.waitForSelector(
          '.mt-10 > .grid > .flex > .z-50 > .text-body-sm:nth-child(1)',
        );
        await page.click(
          '.mt-10 > .grid > .flex > .z-50 > .text-body-sm:nth-child(1)',
        );

        await page.waitForSelector(
          '.flex > .box-border > .mt-10 > .mt-8 > .relative:nth-child(2)',
        );
        await page.click(
          '.flex > .box-border > .mt-10 > .mt-8 > .relative:nth-child(2)',
        );
        await sleep(3000);
        await this.createNewApp(page);
        await sleep(3000);
        const app = await this.getApp(page);
        if (!app) {
          throw new Error('get app failed');
        }
        this.logger.info(`get app ok, app_uuid: ${app.uuid}`);
        this.update({ app_uuid: app.uuid });

        const api_key = await this.getApiKey(page);
        if (!api_key) {
          throw new Error('get api key failed');
        }
        this.update({ api_key });
        this.logger.info('get api key ok, api_key: ' + api_key);
        this.update({ left: 5000 });
        await page.browser().close();
      }
      this.client = CreateAxiosProxy(
        {
          baseURL: `https://app.airops.com/public_api/`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${this.info.api_key}`,
          },
        },
        false,
      );
      this.ws = new WSS(
        `wss://ws-${APP_CLUSTER}.pusher.com/app/${APP_KEY}?protocol=7&client=js&version=8.1.0&flash=false`,
        {
          onOpen: () => {
            this.logger.info('ws on open');
            setInterval(() => {
              this.ws.send(
                JSON.stringify({
                  event: 'pusher:ping',
                  data: {},
                }),
              );
            }, 2 * 60 * 1000);
          },
          onMessage: (data) => {
            const msg = parseJSON<{
              event: string;
              data: string;
              channel: string;
            }>(data, {} as any);
            if (msg.channel) {
              msg.channel = msg.channel.replace('public-', '');
            }
            this.logger.debug(JSON.stringify(data));
            const cb = this.channelMap[msg.channel];
            if (cb) {
              cb(msg.event, msg.data);
            }
          },
          onError: (err: any) => {
            this.logger.error('ws on error, ', err);
            this.destroy({ delFile: false, delMem: true });
          },
          onClose: () => {
            this.logger.error('ws on close');
            this.destroy({ delFile: false, delMem: true });
          },
        },
      );
    } catch (e) {
      this.options?.onInitFailed({
        delFile: true,
        delMem: true,
      });
      throw e;
    }
  }

  async getApiKey(page: Page) {
    try {
      page.goto(
        `https://app.airops.com/${this.info.company_name.toLowerCase()}-0/account/workspace`,
      );
      const res = await page.waitForResponse(
        (res) => res.url().indexOf('/customer_apis/current') > -1,
      );
      const data: { base: string } = await res.json();
      return data.base;
    } catch (e) {
      this.logger.error('get api key failed, ', e);
    }
  }

  async getApp(page: Page) {
    try {
      page.goto('https://app.airops.com/');
      const res = await page.waitForResponse(
        (res) => res.url().indexOf('airops_app_bases') > -1,
      );
      const data: {
        active_version_id: number;
        active_version_number: number;
        uuid: string;
      }[] = await res.json();
      return data[0];
    } catch (e) {
      this.logger.error(e);
    }
  }

  async createNewApp(page: Page) {
    try {
      await page.goto(
        `https://app.airops.com/${this.info.company_name.toLowerCase()}-0/apps/new-chat?template=blank_chat`,
      );
      await sleep(10 * 1000);
      await page.waitForSelector(
        '.relative > .grid > .grid > .flex > .relative:nth-child(2)',
      );
      await page.click(
        '.relative > .grid > .grid > .flex > .relative:nth-child(2)',
      );
      await sleep(3000);
      await page.click(
        '.relative > .grid > .grid > .flex > .relative:nth-child(2)',
      );

      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const app_name = randomStr(10);
      await page.keyboard.type(app_name, { delay: 20 });
      this.update({ app_name });

      await page.waitForSelector(
        '.ReactModal__Content > .flex > .flex > .mt-3 > .relative:nth-child(2)',
      );
      await page.click(
        '.ReactModal__Content > .flex > .flex > .mt-3 > .relative:nth-child(2)',
      );
      this.logger.info('save draft ok');

      await sleep(3000);
      await page.waitForSelector(
        '.react-flow__nodes > .react-flow__node > #initial > .flex:nth-child(2) > .flex',
      );
      await page.click(
        '.react-flow__nodes > .react-flow__node > #initial > .flex:nth-child(2) > .flex',
      );

      await page.waitForSelector('#model');
      await page.click('#model');

      await page.waitForSelector(
        '.flex > .flex > .z-50 > .text-body-sm:nth-child(3) > .flex',
      );
      await page.click(
        '.flex > .flex > .z-50 > .text-body-sm:nth-child(3) > .flex',
      );

      await page.waitForSelector('#initial-show-tool-usage');
      await page.click('#initial-show-tool-usage');

      await page.waitForSelector(
        '.flex > .h-fit > #initial-system > .ace_scroller > .ace_content',
      );
      await page.click(
        '.flex > .h-fit > #initial-system > .ace_scroller > .ace_content',
      );

      await page.waitForSelector(
        '.flex > .h-fit > #initial-system > .ace_scroller > .ace_content',
      );
      await page.click(
        '.flex > .h-fit > #initial-system > .ace_scroller > .ace_content',
      );

      await page.waitForSelector(
        '.flex > .h-fit > #initial-system > .ace_scroller > .ace_content',
      );
      await page.click(
        '.flex > .h-fit > #initial-system > .ace_scroller > .ace_content',
      );

      await page.keyboard.type('You are AI model made by openai');

      await page.waitForSelector(
        '.absolute > .flex > .flex:nth-child(1) > .flex > .relative',
      );
      await page.click(
        '.absolute > .flex > .flex:nth-child(1) > .flex > .relative',
      );
      await page.waitForSelector(
        '.grid > .grid > .flex > .flex > .relative:nth-child(1)',
      );
      await page.click(
        '.grid > .grid > .flex > .flex > .relative:nth-child(1)',
      );

      await page.waitForSelector(
        '.absolute > .relative > .inline-flex > .relative > .peer:nth-child(2)',
      );
      await page.click(
        '.absolute > .relative > .inline-flex > .relative > .peer:nth-child(2)',
      );
      this.logger.info('publish app ok');
    } catch (e) {
      this.logger.error('create new app failed, ', e);
    }
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.ws?.close();
  }
}

export class Airops extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.airops.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return !!v.api_key && !!v.app_uuid && v.left >= 5;
    },
    {
      delay: 1000,
      serial: 1,
    },
  );
  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 4000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    req.messages = req.messages.filter((v) => v.role !== 'system');
    return super.preHandle(req, {
      token: true,
      countPrompt: true,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    try {
      let output = '';
      const channel = child.setMsgListener((event, data) => {
        if (event !== 'agent-response') {
          return;
        }
        const { token, stream_finished } = parseJSON<{
          token: string;
          stream_finished: boolean;
        }>(data, {
          token: '',
          stream_finished: false,
        });
        if (stream_finished) {
          stream.write(Event.done, { content: '' });
          stream.end();
          this.logger.info('recv msg ok');
          return;
        }
        stream.write(Event.message, { content: token });
        output += token;
      });
      const res: { data: { credits_used: number } } = await child.client.post(
        `agent_apps/${child.info.app_uuid}/chat`,
        {
          message: req.prompt,
          session_id: v4(),
          user_current_time: moment().format(),
          inputs: {},
          stream_channel_id: channel,
        },
      );
      if (output.indexOf('We have noticed you') > -1) {
        this.logger.error(`We have noticed you, ${req.messages}`);
        // child.destroy({ delFile: true, delMem: true });
        return;
      }
      child.update({
        left: child.info.left - (res.data.credits_used || 1),
        failed_times: 0,
      });

      child.removeMsgListener(channel);
      if (child.info.left < 5) {
        child.destroy({ delFile: false, delMem: true });
      }
      this.logger.info(JSON.stringify(res.data));
    } catch (e: any) {
      child.update({ failed_times: (child.info.failed_times || 0) + 1 });
      this.logger.error(
        `ask failed mail:${child.info.email},failed_times:${child.info.failed_times}`,
        e,
      );
      stream.write(Event.error, { error: e.message, status: 500 });
      stream.write(Event.done, { content: '' });
      stream.end();
      if (child.info.failed_times >= 10) {
        child.destroy({ delFile: false, delMem: true });
      }
    }
  }
}
