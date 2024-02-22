import {
  Chat,
  ChatOptions,
  ChatRequest,
  ImageGenerationRequest,
  ModelType,
  SpeechRequest,
  TextEmbeddingRequest,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import { ComError, Event, EventStream, parseJSON } from '../../utils';
import { Config } from '../../utils/config';
import { AsyncStoreSN } from '../../asyncstore';
import Application from 'koa';

interface RealReq extends ChatRequest {
  functions?: {
    name: string;
    description?: string;
    parameters: object;
  };
  function_call?: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: {};
  user?: string;
}

interface OpenAIChatOptions extends ChatOptions {
  base_url?: string;
  api_key?: string;
  proxy?: boolean;
  model_map?: { [key: string]: ModelType };
}

const ParamsList = [
  'model',
  'messages',
  'functions',
  'function_call',
  'temperature',
  'top_p',
  'n',
  'stream',
  'stop',
  'max_tokens',
  'presence_penalty',
  'frequency_penalty',
  'logit_bias',
  'user',
  'gizmo_id',
];

export class OpenAI extends Chat {
  private client: AxiosInstance;
  protected options?: OpenAIChatOptions;

  constructor(options?: OpenAIChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: options?.base_url || 'https://api.openai.com/',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options?.api_key || ''}`,
        },
      } as CreateAxiosDefaults,
      false,
      !!options?.proxy,
    );
  }

  support(model: ModelType): number {
    return (
      Config.config.openai?.token_limit?.[model] || Number.MAX_SAFE_INTEGER
    );
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    const reqH = await super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: true,
    });
    reqH.messages = reqH.messages.filter((v) => !!v.content);
    if (this.options?.model_map && this.options.model_map[req.model]) {
      reqH.model = this.options.model_map[req.model];
    }
    return reqH;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const data: RealReq = {
      ...req,
      messages: req.messages,
      model: req.model,
      stream: true,
    };
    for (const key in data) {
      if (ParamsList.indexOf(key) === -1) {
        delete (data as any)[key];
      }
    }
    try {
      const res = await this.client.post('/v1/chat/completions', data, {
        responseType: 'stream',
        headers: {
          accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
          Authorization: `Bearer ${this.options?.api_key || req.secret || ''}`,
          'x-request-id': AsyncStoreSN.getStore()?.sn,
        },
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
          const choices = data.choices || [];
          const { delta, finish_reason } = choices[0] || {};
          if (finish_reason === 'stop') {
            return;
          }
          if (delta) {
            stream.write(Event.message, delta);
          }
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      if (e.response && e.response.data) {
        e.message = await new Promise((resolve, reject) => {
          e.response.data.on('data', (chunk: any) => {
            const content = chunk.toString();
            this.logger.error(content);
            resolve(
              parseJSON<{ error?: { message?: string } }>(content, {})?.error
                ?.message || content,
            );
          });
        });
      }
      this.logger.error(`openai failed: ${e.message}`);
      stream.write(Event.error, { error: e.message, status: e.status });
      stream.end();
    }
  }

  async speech(ctx: Application.Context, req: SpeechRequest): Promise<void> {
    delete req.secret;
    const res = await this.client.post('/v1/audio/speech', req, {
      responseType: 'stream',
    });
    ctx.set(res.headers as any);
    ctx.set('access-control-allow-origin', '*');
    ctx.body = res.data;
  }

  async generations(
    ctx: Application.Context,
    req: ImageGenerationRequest,
  ): Promise<void> {
    const res = await this.client.post('/v1/images/generations', req);
    ctx.set(res.headers as any);
    ctx.set('access-control-allow-origin', '*');
    ctx.body = res.data;
  }

  async embeddings(
    ctx: Application.Context,
    req: TextEmbeddingRequest,
  ): Promise<void> {
    const res = await this.client.post('/v1/embeddings', req);
    ctx.set(res.headers as any);
    ctx.set('access-control-allow-origin', '*');
    ctx.body = res.data;
  }
}
