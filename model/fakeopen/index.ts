import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import {
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
  shuffleArray,
  sleep,
} from '../../utils';
import fs from 'fs';
import { v4 } from 'uuid';
import moment from 'moment/moment';

interface Message {
  role: string;
  content: string;
}

interface RealReq {
  messages: Message[];
  temperature: number;
  stream: boolean;
  model: string;
}

/**
 * {"models":[{"slug":"text-davinci-002-render-sha","max_tokens":8191,"title":"Default (GPT-3.5)","description":"Our fastest model, great for most everyday tasks.","tags":["gpt3.5"],"capabilities":{},"product_features":{}},{"slug":"gpt-4","max_tokens":4095,"title":"GPT-4","description":"Our most capable model, great for tasks that require creativity and advanced reasoning.","tags":["gpt4"],"capabilities":{},"product_features":{}},{"slug":"gpt-4-code-interpreter","max_tokens":8192,"title":"Advanced Data Analysis","description":"An experimental model that can solve tasks by generating Python code and executing it in a Jupyter notebook.\nYou can upload any kind of file, and ask model to analyse it, or produce a new file which you can download.","tags":["beta","gpt4"],"capabilities":{},"product_features":{"attachments":{"type":"code_interpreter"}},"enabled_tools":["tools2"]},{"slug":"gpt-4-plugins","max_tokens":8192,"title":"Plugins","description":"An experimental model that knows when and how to use plugins","tags":["beta","gpt4"],"capabilities":{},"product_features":{},"enabled_tools":["tools3"]}],"categories":[{"category":"gpt_3.5","human_category_name":"GPT-3.5","subscription_level":"free","default_model":"text-davinci-002-render-sha","browsing_model":"text-davinci-002-render-sha-browsing","code_interpreter_model":"text-davinci-002-render-sha-code-interpreter","plugins_model":"text-davinci-002-render-sha-plugins"},{"category":"gpt_4","human_category_name":"GPT-4","subscription_level":"plus","default_model":"gpt-4","browsing_model":"gpt-4-browsing","code_interpreter_model":"gpt-4-code-interpreter","plugins_model":"gpt-4-plugins"}]}
 */

type ValidModelsResp = {
  models: {
    slug: string;
    max_tokens: number;
    title: string;
    description: string;
    tags: string[];
    capabilities: any;
    product_features: any;
  }[];
  categories: {
    category: string;
    human_category_name: string;
    subscription_level: string;
    default_model: string;
    browsing_model: string;
    code_interpreter_model: string;
    plugins_model: string;
  }[];
};

type LoginRes = {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
};

type Account = {
  id: string;
  login_time?: string;
  last_use_time?: string;
  email: string;
  password: string;
  access_token: string;
  token_key: string;
  failedCnt: number;
  invalid?: boolean;
  model?: string;
  plus: boolean;
};

class AccountPool {
  private pool: Record<string, Account> = {};
  private using = new Set<string>();
  private readonly account_file_path = './run/account_fakeopen.json';
  private client: AxiosInstance;

  constructor() {
    this.client = CreateAxiosProxy({
      baseURL: 'https://ai.fakeopen.com',
      headers: {
        accept: '*/*',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        pragma: 'no-cache',
        'sec-ch-ua':
          '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-requested-with': 'XMLHttpRequest',
        cookie:
          'sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%22188a317c40520a-0c3c4294c10036-1b525634-1296000-188a317c406435%22%2C%22first_id%22%3A%22%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer%22%3A%22%22%7D%2C%22identities%22%3A%22eyIkaWRlbnRpdHlfY29va2llX2lkIjoiMTg4YTMxN2M0MDUyMGEtMGMzYzQyOTRjMTAwMzYtMWI1MjU2MzQtMTI5NjAwMC0xODhhMzE3YzQwNjQzNSJ9%22%2C%22history_login_id%22%3A%7B%22name%22%3A%22%22%2C%22value%22%3A%22%22%7D%2C%22%24device_id%22%3A%22188a317c40520a-0c3c4294c10036-1b525634-1296000-188a317c406435%22%7D',
        Referer: 'https://ai.fakeopen.com/auth1',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    } as CreateAxiosDefaults);
    this.initialize();
  }

  async initialize() {
    if (!process.env.FAKE_OPEN_EMAIL || !process.env.FAKE_OPEN_PASSWORD) {
      console.log('fakeopen found 0 account');
      return;
    }
    const mailList = process.env.FAKE_OPEN_EMAIL.split('|');
    const pwdList = process.env.FAKE_OPEN_PASSWORD.split('|');
    if (fs.existsSync(this.account_file_path)) {
      const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
      this.pool = parseJSON(accountStr, {} as Record<string, Account>);
    } else {
      fs.mkdirSync('./run', { recursive: true });
      this.syncfile();
    }
    for (const key in this.pool) {
      this.pool[key].failedCnt = 0;
      this.pool[key].model = undefined;

      if (!('plus' in this.pool)) {
        this.pool[key].plus = true;
      }
    }
    for (const idx in mailList) {
      const mail = mailList[idx];
      const pwd = pwdList[idx];
      if (this.pool[mail]) {
        continue;
      }
      try {
        // 登录获取access_token
        const loginResp = await this.client.post(
          '/auth/login',
          { username: mail, password: pwd },
          {
            responseType: 'json',
          } as AxiosRequestConfig,
        );
        const { access_token } = loginResp.data as LoginRes;
        // 获取可用模型
        const validModelsResp = await this.client.get(
          '/api/models?history_and_training_disabled=false',
          {
            responseType: 'json',
            // 替换headers中的Authorization
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          } as AxiosRequestConfig,
        );
        // 判断有无GPT-4权限,即plus权限
        const { categories } = validModelsResp.data as ValidModelsResp;
        const plus =
          categories.find((item) => item.category === 'gpt_4')
            ?.subscription_level === 'plus';

        const registerResp = await this.client.post(
          '/token/register',
          {
            unique_name: mail,
            access_token: access_token,
            expires_in: 0,
            site_limit: '',
            show_conversations: true,
          },
          {
            responseType: 'json',
          } as AxiosRequestConfig,
        );
        const { token_key } = registerResp.data as { token_key: string };
        this.pool[mail] = {
          id: v4(),
          email: mail,
          password: pwd,
          access_token: access_token,
          token_key: token_key,
          failedCnt: 0,
          invalid: false,
          plus: plus,
        };
        this.syncfile();
      } catch (e) {
        console.error(e);
        this.pool[mail] = {
          id: v4(),
          email: mail,
          password: pwd,
          access_token: '',
          token_key: '',
          failedCnt: 0,
          invalid: true,
          plus: false,
        };
      }
    }
    console.log(`read fakeopen account total:${Object.keys(this.pool).length}`);
    this.syncfile();
  }

  public syncfile() {
    fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
  }

  public getByID(id: string) {
    for (const item in this.pool) {
      if (this.pool[item].id === id) {
        return this.pool[item];
      }
    }
  }

  public delete(id: string) {
    for (const v in this.pool) {
      const vv = this.pool[v];
    }
    this.using.delete(id);
    this.syncfile();
  }

  public release(id: string) {
    this.using.delete(id);
  }

  public get(isPlus: boolean): Account {
    for (const vv of shuffleArray(Object.values(this.pool))) {
      if (
        (!vv.invalid ||
          moment().subtract(5, 'm').isAfter(moment(vv.last_use_time))) &&
        !this.using.has(vv.id) &&
        ((isPlus && vv.plus === isPlus) || !isPlus)
      ) {
        vv.invalid = false;
        this.syncfile();
        this.using.add(vv.id);
        return vv;
      }
    }
    console.log('fakeopen accessToken run out!!!!!!');
    return {
      id: v4(),
      email: '',
      failedCnt: 0,
    } as Account;
  }
}

export class FakeOpen extends Chat {
  private client: AxiosInstance;
  private accountPool: AccountPool;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://ai.fakeopen.com/v1/',
        headers: {
          'Content-Type': 'application/json',
          accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
          Authorization: `Bearer ${
            process.env.FAKE_OPEN_KEY ||
            'pk-this-is-a-real-free-api-key-pk-for-everyone'
          }`,
        },
      } as CreateAxiosDefaults,
      false,
    );
    this.accountPool = new AccountPool();
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5_16k:
        return 21000;
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5Turbo:
        return 21000;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      messages: [{ role: 'user', content: req.prompt }],
      temperature: 1.0,
      model: req.model,
      stream: true,
    };
    const account = this.accountPool.get(req.model === ModelType.GPT4);
    try {
      const res = await this.client.post('/chat/completions', data, {
        responseType: 'stream',
        // 替换headers中的Authorization
        headers: {
          Authorization: `Bearer ${account.token_key}`,
        },
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
            stream.write(Event.done, { content: '' });
            stream.end();
            this.accountPool.release(account.id);
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            stream.write(Event.error, { error: 'not found data.choices' });
            stream.end();
            this.accountPool.release(account.id);
            return;
          }
          const [
            {
              delta: { content = '' },
              finish_reason,
            },
          ] = data.choices;
          if (finish_reason === 'stop') {
            return;
          }
          stream.write(Event.message, { content });
        }),
      );
    } catch (e: any) {
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
