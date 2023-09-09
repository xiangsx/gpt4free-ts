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
  temperature: number;
  stream: boolean;
  model: string;
}

export class Pap extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://www.papayagpt.com',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        accept: 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5_16k:
        return 15000;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: any = {
      rolePrompt: '',
      prompt: req.prompt,
      temperature: 1.0,
      roleId: 1,
      model: 'gpt-3.5-turbo-16k-0613',
    };
    try {
      const res = await this.client.post('/app/ai/message/send', data, {
        responseType: 'stream',
        headers: {
          Origin: 'https://www.papayagpt.com',
          Referer: 'https://www.papayagpt.com/',
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
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
