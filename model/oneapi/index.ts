import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  Message,
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
import { Config } from '../../utils/config';

interface RealReq {
  messages: Message[];
  temperature: number;
  stream: boolean;
  model: string;
}

export class OneAPI extends Chat {
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
    return Number.MAX_SAFE_INTEGER;
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
      const client = CreateAxiosProxy(
        {
          baseURL: `${Config.config.one_api.base_url}`,
          headers: {
            'Content-Type': 'application/json',
            accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Proxy-Connection': 'keep-alive',
          },
          proxy: Config.config.one_api.proxy,
        } as CreateAxiosDefaults,
        false,
        Config.config.one_api.proxy,
      );
      const res = await client.post('/v1/chat/completions', data, {
        headers: {
          Authorization: `Bearer ${Config.config.one_api.api_key}`,
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
      this.logger.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
