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
} from '../../utils';

interface Message {
  role: string;
  content: string;
}

const modelMap = {
  [ModelType.GPT3p5_16k]: 'gpt-3.5-turbo-16k',
  [ModelType.GPT4]: 'gpt-4',
  [ModelType.GPT3p5Turbo]: 'gpt-3.5-turbo',
} as Record<ModelType, string>;

interface RealReq {
  messages: Message[];
  temperature: number;
  stream: boolean;
  model: string;
}

export class Better extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://openai-proxy-api.vercel.app/v1/',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.58',
        Referer: 'https://chat.ylokh.xyz/',
        Origin: 'https://chat.ylokh.xyz',
        'Content-Type': 'application/json',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5_16k:
        return 15000;
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5Turbo:
        return 4000;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      messages: [{ role: 'user', content: req.prompt }],
      temperature: 1.0,
      model: modelMap[req.model],
      stream: true,
    };
    try {
      const res = await this.client.post('/chat/completions', data, {
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            stream.write(Event.error, { error: 'not found data.choices' });
            stream.end();
            return;
          }
          const [
            {
              delta: { content = '' },
              finish_reason,
            },
          ] = data.choices;
          if (finish_reason === 'stop') {
            stream.write(Event.done, { content: '' });
            stream.end();
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
