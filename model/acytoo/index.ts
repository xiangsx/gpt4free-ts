import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  ModelType,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import { Event, EventStream } from '../../utils';
import moment from 'moment';

interface Message {
  role: string;
  content: string;
  createdAt: number;
}

interface RealReq {
  key: string;
  model: string;
  messages: Message[];
  temperature: number;
  password: string;
}

export class AcyToo extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://chat.acytoo.com',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        accept: '*/*',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 4000;
      default:
        return 0;
    }
  }

  async preHandle(
    req: ChatRequest,
    options?: { token?: boolean; countPrompt?: boolean },
  ): Promise<ChatRequest> {
    return super.preHandle(req, { token: true, countPrompt: false });
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    let i = 10;
    const data: RealReq = {
      temperature: 1.0,
      model: req.model,
      key: '',
      messages: req.messages.map((v) => ({
        role: v.role,
        content: contentToString(v.content),
        createdAt: moment().valueOf() + i++ * 100,
      })),
      password: '',
    };
    try {
      const res = await this.client.post('/api/completions', data, {
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.pipe(
        es.map(async (chunk: any, cb: any) => {
          const content: string = chunk.toString();
          const idx = content.indexOf('\n\nY');
          if (idx > -1) {
            stream.write(Event.message, { content: content.slice(0, idx) });
            res.data.destroy();
            return;
          }
          stream.write(Event.message, { content: chunk.toString() });
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
