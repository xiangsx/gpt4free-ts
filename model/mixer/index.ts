import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, TWToCN, sleep, parseJSON } from '../../utils';
import { ChildOptions, ComChild, ComInfo, Info, Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import { CreateEmail } from '../../utils/emailFactory';
import es from 'event-stream';
import moment from 'moment/moment';
import { v4 } from 'uuid';

interface Account extends ComInfo {
  email: string;
  token?: string;
  retryAfter: number;
  limited: boolean;
}
class Child extends ComChild<Account> {
  public readonly client: AxiosInstance;
  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);

    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://chatai.mixerbox.com/api/',
        headers: {
          accept: 'application/json, text/plain, */*',
          'content-type': 'application/json',
          Referer: 'https://chatai.mixerbox.com/chat',
        },
      },
      false,
      false,
    );
  }
  async init(): Promise<void> {
    if (this.info.token) {
      return;
    }
    this.update({ limited: false });
    try {
      const mailBox = CreateEmail(Config.config.mixer.mailType);
      const email = await mailBox.getMailAddress();
      this.update({ email });
      const login: any = await this.client.post('/login', { email });
      const verifyTK = login.data.verifyToken;
      let authCode;
      for (const v of await mailBox.waitMails()) {
        authCode = (v as any).subject.replace(/[^\d]/g, '');
        if (!authCode) {
          throw new Error('authCode not found');
        }
      }
      await sleep(2000);
      const access: any = await this.client.post(
        '/login',
        { email, authCode },
        { headers: { cookie: `verify_token=${verifyTK}` } },
      );
      this.update({ token: access.data.accessToken });
    } catch (e) {
      this.options?.onInitFailed({
        delFile: true,
        createNew: true,
      });
      throw e;
    }
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  valid(): boolean {
    return !!this.info.token;
  }
}

export class Mixer extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.mixer.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.token) {
        return false;
      }
      if (v.limited && moment().unix() < v.retryAfter) {
        return false;
      }
      return true;
    },
    { delay: 1000 },
  );
  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5Turbo:
        return 5000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    for (const v of req.messages) {
      if (v.role === 'system') {
        v.role = 'assistant';
      }
    }
    return super.preHandle(req, {
      token: false,
      countPrompt: false,
      forceRemove: true,
    });
  }

  async getReward(client: AxiosInstance, rewardId: string) {
    try {
      await client.put(
        `/reward/${rewardId}`,
        { watchAdsStatus: 'completed' },
        {
          headers: {
            Referer: `https://chatai.mixerbox.com/chat_limit?id=${rewardId}&lang=zh&channel=chatroom&c=chatroom&cid=chatroom&cuid=${v4()}&g=default`,
          },
        },
      );
    } catch (e: any) {
      this.logger.error('get reward failed, ', e.message);
    }
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
      const res = await child.client.post(
        '/chat/stream',
        {
          prompt: req.messages,
          lang: 'zh',
          model: req.model,
          // plugins: [ 'browsing', 'web_search', 'chat_map', 'weather', 'image_gen', 'news', 'translate', 'qr', 'chat_pdf', 'scholar', 'chat_video', 'prompt_pro', 'one_player', 'tv', 'podcasts', 'photo_magic', 'calculator', 'chat_email', 'calendar', 'chat_drive',],
          plugins: [],
          getRecommendQuestions: true,
          isSummarize: false,
          webVersion: '1.3.0',
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76',
          isExtension: false,
        },
        {
          headers: {
            authority: 'chatai.mixerbox.com',
            accept: '*/*',
            'accept-language':
              'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'content-type': 'application/json',
            origin: 'https://chatai.mixerbox.com',
            referer: 'https://chatai.mixerbox.com/chat',
            'sec-ch-ua':
              '"Chromium";v="116", "Not)A;Brand";v="24", "Microsoft Edge";v="116"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76',
            cookie: `access_token=${child.info.token};has_token=true`,
          },
          responseType: 'stream',
        },
      );
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map((chunk: any) => {
          const data = chunk.toString();
          if (!data) {
            return;
          }
          let [event, , content] = data.split('\n');
          if (
            !event ||
            event.indexOf('signal') > -1 ||
            event.indexOf('undefined') > -1
          ) {
            return;
          }
          content = content
            .replace('data:', '')
            .replace(/\[SPACE\]/g, ' ')
            .replace(/\[NEWLINE\]/g, '\n')
            .replace(/MixerBox/g, 'OpenAi');
          content = TWToCN(content);
          stream.write(Event.message, { content });
        }),
      );
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      this.logger.error(
        `ask failed，msg:${JSON.stringify(req.messages)}: %s`,
        e,
      );
      stream.write(Event.error, { error: e.message, status: 500 });
      stream.write(Event.done, { content: '' });
      stream.end();
      if (e.response.status === 429) {
        e.response.data.on('data', (chunk: any) => {
          const data = parseJSON<any>(chunk.toString(), {});
          if (!data.rewardId) {
            child.destroy();
            child.update({ limited: true, retryAfter: data.retryAfter });
            return;
          }
          this.getReward(child.client, data.rewardId);
        });
      }
    }
  }
}
