import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { ComError, Event, EventStream, randomStr } from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateAxiosProxy, CreateNewAxios } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { Page } from 'puppeteer';
import { AxiosInstance } from 'axios';

interface Account extends ComInfo {
  email: string;
  password: string;
  token: string;
}

const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT3p5_16k]: '87Xacu8D07CL',
  [ModelType.GPT41106Preview]: '87Xacu8D07C2',
};

class Child extends ComChild<Account> {
  public client: AxiosInstance;
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateNewAxios({
      baseURL: 'https://packdir.com',
      headers: {
        Referer: 'https://airoom.chat/',
      },
    });
  }

  async init(): Promise<void> {
    if (this.info.token) {
      return;
    }
    try {
      const email = `${randomStr(
        10 + Math.floor(Math.random() * 10),
      )}@gmail.com`;
      const password = randomStr(10 + Math.floor(Math.random() * 10));
      this.update({ email, password });
      await this.signup();
      await this.login();
    } catch (e) {
      throw e;
    }
  }

  async signup() {
    const res = await this.client.post('/api/airoom/signup', {
      email: this.info.email,
      password: this.info.password,
    });
    if (res.data.message !== 'success') {
      throw new Error('sign up error');
    }
  }

  async login() {
    const res: { data: { token: string; message: string } } =
      await this.client.post('/api/airoom/login', {
        email: this.info.email,
        password: this.info.password,
      });
    if (res.data.message !== 'ok') {
      throw new Error('login failed');
    }
    if (!res.data.token) {
      throw new Error('no token');
    }
    this.update({
      token: res.data.token,
    });
  }

  async room(model: ModelType) {
    if (!ModelMap[model]) {
      throw new Error(`not support model:${model}`);
    }
    const res: {
      data: { message: string; room_uuid: string; session_uuid: string };
    } = await this.client.post(
      'https://packdir.com/api/airoom/room',
      {
        botUuid: ModelMap[model],
        botType: 0,
        roomName: 'Untitled',
      },
      {
        headers: { Authorization: `Bearer ${this.info.token}` },
      },
    );
    if (!res.data.room_uuid || !res.data.session_uuid) {
      throw new ComError('can not get room info', ComError.Status.Forbidden);
    }
    return { sid: res.data.session_uuid, rid: res.data.room_uuid };
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class AIRoom extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.airoom.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.email || !v.password) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: () => Config.config.airoom.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5_16k:
        return 12000;
      case ModelType.GPT41106Preview:
        return 28000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: false,
      countPrompt: true,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    try {
      const { sid, rid } = await child.room(req.model);
      const res = await child.client.post(
        '/api/airoom/message',
        {
          prompt: req.prompt,
          rid,
          sid,
        },
        {
          headers: { Authorization: `Bearer ${child.info.token}` },
          responseType: 'stream',
        },
      );
      res.data.on('data', (chunk: string) => {
        stream.write(Event.message, { content: chunk.toString() });
      });
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      stream.write(Event.error, { error: e.message });
      stream.write(Event.done, { content: '' });
      stream.end();
      child.update({ token: '' });
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
