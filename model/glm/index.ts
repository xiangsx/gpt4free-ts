import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  ImageGenerationRequest,
  ModelType,
  SpeechRequest,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import {
  ComError,
  Event,
  EventStream,
  extractHttpFileURLs,
  parseJSON,
} from '../../utils';
import { Config } from '../../utils/config';
import { AsyncStoreSN } from '../../asyncstore';
import Application from 'koa';
import jwt from 'jsonwebtoken';

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

interface GLMChatOptions extends ChatOptions {
  base_url?: string;
  api_key?: string;
  proxy?: boolean;
  model_map?: { [key: string]: ModelType };
}

const ParamsList = ['model', 'messages', 'stream', 'tools', 'tool_choice'];

/**
 * 生成鉴权token
 *
 * @param apiKey - API Key，格式为 {id}.{secret}
 * @returns 鉴权token
 */
function generateAuthToken(apiKey: string): string {
  const [id, secret] = apiKey.split('.');

  if (!id || !secret) {
    throw new Error('Invalid API Key format. Expected format: {id}.{secret}');
  }

  const now = Date.now();

  // 定义JWT的payload
  const payload = {
    api_key: id,
    exp: Math.floor(now / 1000) + 60 * 60, // 设置token过期时间为1小时后
    timestamp: now,
  };

  // 定义JWT的header
  const header = {
    alg: 'HS256',
    sign_type: 'SIGN',
  };

  // 生成JWT token
  const token = jwt.sign(payload, secret, {
    header: header,
    algorithm: 'HS256',
  });

  return token;
}

export class GLM extends Chat {
  private client: AxiosInstance;
  protected options?: GLMChatOptions;

  constructor(options?: GLMChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: options?.base_url || 'https://open.bigmodel.cn/api/paas/v4/',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${generateAuthToken(options?.api_key || '')}`,
        },
      } as CreateAxiosDefaults,
      false,
      !!options?.proxy,
    );
  }

  support(model: ModelType): number {
    return Config.config.glm?.token_limit?.[model] || Number.MAX_SAFE_INTEGER;
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
    const message = data.messages[data.messages.length - 1];
    if (typeof message.content === 'string') {
      let images = extractHttpFileURLs(message.content);
      if (images.length) {
        for (const v of images) {
          message.content = message.content.replace(v, '');
        }
        message.content = [
          {
            type: 'text',
            text: message.content,
          },
          ...images.map(
            (v) =>
              ({
                type: 'image_url',
                image_url: {
                  url: v,
                },
              } as any),
          ),
        ];
      }
    }
    try {
      const res = await this.client.post('/chat/completions', data, {
        responseType: 'stream',
        headers: {
          accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
          Authorization: `Bearer ${generateAuthToken(
            this.options?.api_key || req.secret || '',
          )}`,
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
      this.logger.error(e.message);
      e.response?.data?.on?.('data', (chunk: any) =>
        this.logger.error(chunk.toString()),
      );
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }

  async speech(ctx: Application.Context, req: SpeechRequest): Promise<void> {
    delete req.secret;
    const res = await this.client.post('/audio/speech', req, {
      responseType: 'stream',
    });
    ctx.set(res.headers as any);
    ctx.body = res.data;
  }

  async generations(
    ctx: Application.Context,
    req: ImageGenerationRequest,
  ): Promise<void> {
    const res = await this.client.post('/images/generations', req);
    ctx.set(res.headers as any);
    ctx.body = res.data;
  }
}
