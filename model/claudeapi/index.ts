import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import { ComError, Event, EventStream, parseJSON } from '../../utils';

interface Message {
  role: string;
  content: string;
}

interface RealReq {
  model: string;
  prompt: string;
  max_tokens_to_sample: number;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  metadata?: object;
  stream?: boolean;
}

interface ClaudeChatOptions extends ChatOptions {
  base_url?: string;
  api_key?: string;
  proxy?: boolean;
  model_map?: { [key: string]: ModelType };
}

const ParamsList = [
  'model',
  'prompt',
  'max_tokens_to_sample',
  'stop_sequences',
  'temperature',
  'top_p',
  'top_k',
  'metadata',
  'stream',
];

export class ClaudeAPI extends Chat {
  private client: AxiosInstance;
  protected options?: ClaudeChatOptions;
  constructor(options?: ClaudeChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: options?.base_url || 'https://api.anthropic.com/',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
          'x-api-key': `${options?.api_key || ''}`,
          'anthropic-version': '2023-06-01',
        },
      } as CreateAxiosDefaults,
      false,
      !!options?.proxy,
    );
  }

  support(model: ModelType): number {
    return Number.MAX_SAFE_INTEGER;
  }

  async preHandle(
    req: ChatRequest,
    options?: {
      token?: boolean;
      countPrompt?: boolean;
      forceRemove?: boolean;
      stream?: EventStream;
    },
  ): Promise<ChatRequest> {
    const reqH = await super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: false,
    });
    if (this.options?.model_map && this.options.model_map[req.model]) {
      reqH.model = this.options.model_map[req.model];
    }
    reqH.prompt =
      reqH.messages
        .map(
          (v) =>
            `\n\n${v.role === 'assistant' ? 'Assistant' : 'Human'}: ${
              v.content
            }`,
        )
        .join() + '\n\nAssistant:';
    return reqH;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      max_tokens_to_sample: 100 * 10000,
      ...req,
      prompt: req.prompt,
      model: req.model,
      stream: true,
    };
    for (const key in data) {
      if (ParamsList.indexOf(key) === -1) {
        delete (data as any)[key];
      }
    }
    try {
      const res = await this.client.post('/v1/complete', data, {
        responseType: 'stream',
        headers: {
          'x-api-key': `${this.options?.api_key || req.secret || ''}`,
        },
      } as AxiosRequestConfig);
      let old = '';
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('event: completion\r\ndata: ', '');
          if (!dataStr) {
            return;
          }
          const data = parseJSON<{ completion: string }>(dataStr, {} as any);
          if (!data.completion) {
            return;
          }
          if (!data.completion) {
            return;
          }
          old += data.completion;
          stream.write(Event.message, { content: data.completion });
        }),
      );
      res.data.on('close', () => {
        if (old.trim().length === 0) {
          stream.write(Event.error, { error: 'no response' });
        }
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      this.logger.error(
        `ask stream failed, apikey:${
          (this.options as ClaudeChatOptions).api_key
        } ${e.message}`,
      );
      e.response?.data.on('data', (chunk: any) =>
        console.log(
          `ask stream failed, apikey:${
            (this.options as ClaudeChatOptions).api_key
          }`,
          chunk.toString(),
        ),
      );
      throw new ComError(e.message, e.response?.status);
    }
  }
}
