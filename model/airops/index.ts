import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, parseJSON } from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateAxiosProxy, WSS } from '../../utils/proxyAgent';
import { AxiosInstance } from 'axios';
import moment from 'moment/moment';
import { v4 } from 'uuid';

const APP_KEY = 'af9e46318302fccfc6db';
const APP_CLUSTER = 'mt1';

interface Account extends ComInfo {
  app_uuid: string;
  api_key: string;
  left: number;
}
class Child extends ComChild<Account> {
  public readonly client: AxiosInstance;
  public channel = v4();
  public ws!: WSS;
  private onMsg?: (event: string, data: string) => void;
  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
    this.client = CreateAxiosProxy(
      {
        baseURL: `https://app.airops.com/public_api/airops_apps/${this.info.app_uuid}/`,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${this.info.api_key}`,
        },
      },
      false,
    );
  }

  public setMsgListener(cb: (event: string, data: string) => void) {
    this.onMsg = cb;
  }

  async init(): Promise<void> {
    if (!this.info.app_uuid || !this.info.api_key) {
      throw new Error('app_uuid or api_key is empty');
    }
    try {
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
            this.ws.send(
              JSON.stringify({
                event: 'pusher:subscribe',
                data: {
                  auth: '',
                  channel: `public-${this.channel}`,
                },
              }),
            );
          },
          onMessage: (data) => {
            const msg = parseJSON<{
              event: string;
              data: string;
              channel: string;
            }>(data, {} as any);
            this.logger.debug(JSON.stringify(data));
            this.onMsg?.(msg.event, msg.data);
          },
          onError: (err: any) => {
            this.logger.error('ws on error, ', err);
            this.destroy({ delFile: false, delMem: true });
          },
          onClose: () => {
            this.logger.error('ws on close');
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

  use(): void {
    this.options?.onUse();
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
      if (!v.app_uuid || !v.api_key) {
        return false;
      }
      return v.left > 0;
    },
    {
      delay: 1000,
      preHandleAllInfos: async () => {
        const allInfos = [];
        for (const v of Config.config.airops.account) {
          for (let i = 0; i < Config.config.airops.concurrency_size; i++) {
            allInfos.push({
              id: v4(),
              left: 5000,
              ready: false,
              app_uuid: v.app_uuid,
              api_key: v.api_key,
            } as Account);
          }
        }
        return allInfos;
      },
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
      child.setMsgListener((event, data) => {
        switch (event) {
          case 'chunk':
            const { content } = parseJSON<{ content: string }>(data, {
              content: '',
            });
            stream.write(Event.message, { content });
            return;
          case 'step-stream-completed':
            stream.write(Event.done, { content: '' });
            stream.end();
            child.release();
            return;
          default:
            return;
        }
      });
      const res = await child.client.post('/execute', {
        inputs: {
          question: req.prompt,
        },
        stream_channel_id: child.channel,
      });
      this.logger.info(JSON.stringify(res.data));
    } catch (e: any) {
      this.logger.error(
        `ask failed，msg:${JSON.stringify(req.messages)}: %s`,
        e,
      );
      stream.write(Event.error, { error: e.message, status: 500 });
      stream.write(Event.done, { content: '' });
      stream.end();
    }
  }
}
