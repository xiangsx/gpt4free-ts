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
  getRandomOne,
  MessageData,
  parseJSON,
} from '../../utils';
import { getRandomValues } from 'crypto';

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

export class OpenAI extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: ' https://api.openai.com/v1/',
        headers: {
          'Content-Type': 'application/json',
          accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.GPT3p5_16k:
        return 10000;
      default:
        return 0;
    }
  }

  getRandomKey() {
    const keys: string[] = process.env.OPENAI_KEY?.split?.('|') || [];
    return getRandomOne(keys);
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      messages: req.messages,
      temperature: 1.0,
      model: req.model,
      stream: true,
    };
    try {
      const res = await this.client.post('/chat/completions', data, {
        headers: {
          Authorization: `Bearer ${this.getRandomKey()}`,
        },
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
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
            return;
          }
          stream.write(Event.message, { content });
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
