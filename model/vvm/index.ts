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
import { ErrorData, Event, EventStream, MessageData } from '../../utils';

interface Model {
  id: string;
  name: string;
}

const modelMap = {
  [ModelType.GPT4]: {
    id: 'gpt-4',
    name: 'GPT-4',
  },
  [ModelType.GPT3p5_16k]: {
    id: 'gpt-3.5-turbo-16k',
    name: 'GPT-3.5-TURBO-16K',
  },
  [ModelType.GPT3p5Turbo]: {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5-TURBO',
  },
} as Record<ModelType, Model>;

interface RealReq {
  model: Model;
  messages: Message[];
  key: string;
  prompt: string;
  temperature: number;
}

export class VVM extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://chat.aivvm.com/api',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
      },
    } as CreateAxiosDefaults);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5Turbo:
        return 5000;
      case ModelType.GPT3p5_16k:
        return 15000;
      default:
        return 0;
    }
  }

  public async ask(req: ChatRequest): Promise<ChatResponse> {
    const stream = new EventStream();
    const res = await this.askStream(req, stream);
    const result: ChatResponse = {
      content: '',
    };
    return new Promise((resolve) => {
      stream.read(
        (event, data) => {
          switch (event) {
            case Event.done:
              break;
            case Event.message:
              result.content += (data as MessageData).content || '';
              break;
            case Event.error:
              result.error = (data as ErrorData).error;
              break;
          }
        },
        () => {
          resolve(result);
        },
      );
    });
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      temperature: 1,
      key: '',
      messages: req.messages,
      model: modelMap[req.model],
      prompt: '',
    };
    try {
      const res = await this.client.post('/chat', data, {
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.on('end', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
      res.data.pipe(
        es.map(async (chunk: any, cb: any) => {
          stream.write(Event.message, { content: chunk.toString() });
        }),
      );
    } catch (e: any) {
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
