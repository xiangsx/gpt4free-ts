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
import {
  CreateAxiosProxy,
  CreateNewAxios,
  CreateNewPage,
} from '../../utils/proxyAgent';
import es from 'event-stream';
import { ComError, Event, EventStream, parseJSON } from '../../utils';
import { Config } from '../../utils/config';
import { AsyncStoreSN } from '../../asyncstore';
import Application from 'koa';
import {
  CreateVideoTaskRequest,
  QueryVideoTaskRequest,
  TranscriptionRequest,
} from '../define';
import { SongOptions } from '../suno/define';
import { AwsLambda } from 'elastic-apm-node/types/aws-lambda';

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
  'response_format',
];

export class OpenAI extends Chat {
  private client: AxiosInstance;
  protected options?: OpenAIChatOptions;

  constructor(options?: OpenAIChatOptions) {
    super(options);
    this.client = this.newClient();
  }

  newClient() {
    return CreateNewAxios(
      {
        baseURL: this.options?.base_url || 'https://api.openai.com/',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options?.api_key || ''}`,
        },
        timeout: 120 * 1000,
      } as CreateAxiosDefaults,
      {
        proxy: this.options?.proxy,
      },
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
    return reqH;
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    let model = req.model;
    if (this.options?.model_map && this.options.model_map[req.model]) {
      model = this.options.model_map[req.model];
    }
    const data: RealReq = {
      ...req,
      max_tokens: req.max_tokens || Config.config.openai.max_tokens?.[model],
      messages: req.messages,
      model,
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
        timeout: Config.config.openai?.stream_timeout || 20 * 1000,
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

  async transcriptions(
    ctx: Application.Context,
    req: TranscriptionRequest,
  ): Promise<void> {
    const res = await this.client.post('/v1/audio/transcriptions', req.form, {
      headers: req.form.getHeaders(),
    });
    ctx.body = res.data;
  }

  async createVideoTask(
    ctx: Application.Context,
    req: CreateVideoTaskRequest,
  ): Promise<void> {
    const res = await this.client.post('/v1/video/create', req);
    ctx.body = res.data;
  }

  async queryVideoTask(
    ctx: Application.Context,
    req: QueryVideoTaskRequest,
  ): Promise<void> {
    const res = await this.client.get('/v1/video/query', { params: req });
    ctx.body = res.data;
  }

  async createSong(ctx: Application.Context, req: SongOptions) {
    const res = await this.client.post('/v1/song/create', req);
    ctx.body = res.data;
  }

  async feedSong(
    ctx: Application.Context,
    req: { ids: string[]; server_id: string },
  ) {
    const res = await this.client.get('/v1/song/feed', {
      params: { server_id: req.server_id, ids: req.ids.join(',') },
    });
    ctx.body = res.data;
  }
}
