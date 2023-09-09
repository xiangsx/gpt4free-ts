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

interface RealReq {
  messages: Message[];
  stream: boolean;
  model: string;
  temperature: number;
  presence_penalty: number;
}

export class Mcbbs extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://ai.88lin.eu.org/api',
      headers: {
        'Content-Type': 'application/json',
        accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 4000;
      case ModelType.GPT3p5_16k:
        return 15000;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      stream: true,
      messages: [{ role: 'user', content: req.prompt }],
      temperature: 1,
      presence_penalty: 2,
      model: 'gpt-3.5-turbo',
    };
    try {
      const res = await this.client.post('/openai/v1/chat/completions', data, {
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (dataStr === '[DONE]') {
            stream.write(Event.done, { content: '' });
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            cb(null, '');
            return;
          }
          const [
            {
              delta: { content = '' },
            },
          ] = data.choices;
          stream.write(Event.message, { content });
        }),
      );
      res.data.on('close', () => {
        stream.end();
      });
    } catch (e: any) {
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
    }
  }
}
