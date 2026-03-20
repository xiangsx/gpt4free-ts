import {
  Chat,
  ChatOptions,
  ChatRequest,
  Message,
  ModelType,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import {
  Event,
  EventStream,
  parseJSON,
} from '../../utils';
import { Config } from '../../utils/config';

interface MiniMaxChatOptions extends ChatOptions {
  base_url?: string;
  api_key?: string;
  proxy?: boolean;
}

interface RealReq {
  messages: Message[];
  temperature: number;
  stream: boolean;
  model: string;
  max_tokens?: number;
}

const MiniMaxModelContext: Partial<Record<ModelType, number>> = {
  [ModelType.MiniMaxM2_7]: 1048576,
  [ModelType.MiniMaxM2_5]: 1048576,
  [ModelType.MiniMaxM2_5_highspeed]: 204800,
};

export class MiniMax extends Chat {
  private base_url: string;
  private api_key: string;
  private proxy: boolean;

  constructor(options?: MiniMaxChatOptions) {
    super(options);
    this.base_url =
      options?.base_url ||
      Config.config.minimax?.base_url ||
      'https://api.minimax.io/v1';
    this.api_key =
      options?.api_key ||
      Config.config.minimax?.api_key ||
      process.env.MINIMAX_API_KEY ||
      '';
    this.proxy = options?.proxy ?? Config.config.minimax?.proxy ?? false;
  }

  support(model: ModelType): number {
    return MiniMaxModelContext[model] || 0;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const temperature = Math.max(0, Math.min(req.temperature ?? 0.7, 1.0));
    const data: RealReq = {
      messages: req.messages,
      temperature,
      model: req.model,
      stream: true,
    };
    if (req.max_tokens) {
      data.max_tokens = req.max_tokens;
    }
    try {
      const client = CreateAxiosProxy(
        {
          baseURL: this.base_url,
          headers: {
            'Content-Type': 'application/json',
            accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Proxy-Connection': 'keep-alive',
          },
        } as CreateAxiosDefaults,
        false,
        this.proxy,
      );
      const res = await client.post('/chat/completions', data, {
        headers: {
          Authorization: `Bearer ${this.api_key}`,
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
