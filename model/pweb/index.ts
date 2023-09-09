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
  randomUserAgent,
} from '../../utils';
//@ts-ignore

interface RealReq {
  prompt: string;
  options: any;
  systemMessage: string;
  temperature: number;
  top_p: number;
  model: string;
  user: string | null;
}

export class PWeb extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy({
      baseURL: 'https://p.v50.ltd/api/',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        Pragma: 'no-cache',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
        'User-Agent': randomUserAgent(),
      },
    } as CreateAxiosDefaults);
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
      model: req.model,
      prompt: req.prompt,
      options: {},
      systemMessage:
        "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown.",
      temperature: 1,
      top_p: 1,
      user: null,
    };
    try {
      const res = await this.client.post('/chat-process', data, {
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.pipe(
        es.map((chunk: any, cb: any) => {
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
