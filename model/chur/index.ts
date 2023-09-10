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
  MessageData,
  parseJSON,
} from '../../utils';

interface RealReq {
  messages: Message[];
  model: string;
  temperature: number;
  presence_penalty: number;
  top_p: number;
  frequency_penalty: number;
  stream: boolean;
}

export class Chur extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://free.churchless.tech',
        headers: {
          'Content-Type': 'application/json',
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
        return 2500;
      case ModelType.GPT3p5_16k:
        return 10000;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      messages: req.messages,
      model: req.model,
      temperature: 1,
      presence_penalty: 0,
      top_p: 1,
      frequency_penalty: 0,
      stream: true,
    };
    try {
      const res = await this.client.post('/v1/chat/completions', data, {
        responseType: 'stream',
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
    } catch (e: any) {
      this.logger.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
