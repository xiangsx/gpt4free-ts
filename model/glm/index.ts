import {
  Chat,
  ChatOptions,
  ChatRequest,
  ImageGenerationRequest,
  ModelType,
  Site,
  SpeechRequest,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import {
  checkSensitiveWords,
  downloadAndUploadCDN,
  Event,
  EventStream,
  extractHttpFileURLs,
  extractJSON,
  MessageData,
  parseJSON,
  retryFunc,
  sleep,
  ThroughEventStream,
} from '../../utils';
import { Config } from '../../utils/config';
import { AsyncStoreSN } from '../../asyncstore';
import Application from 'koa';
import jwt from 'jsonwebtoken';
import Router from 'koa-router';
import { chatModel } from '../index';
import { GenVideoReq } from '../luma/define';
import { Child } from '../luma/child';
import { LumaPrompt } from '../luma/prompt';
import {
  AsyncResultRes,
  VideoGenerationsReq,
  VideoGenerationsRes,
} from './define';
import { GlmCogViewXPrompt } from './prompt';

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
    return '';
  }

  const now = Date.now();

  // 定义JWT的payload
  const payload = {
    api_key: id,
    exp: Math.floor(now / 1000) + 120 * 24 * 60 * 60, // 设置token过期时间为1小时后
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
        baseURL:
          options?.base_url ||
          Config.config.glm?.base_url ||
          'https://open.bigmodel.cn/api/paas/v4/',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${generateAuthToken(
            options?.api_key || Config.config.glm?.api_key || '',
          )}`,
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

  async videoGenerations(
    req: VideoGenerationsReq,
  ): Promise<VideoGenerationsRes> {
    const res = await this.client.post('/videos/generations', req);
    return res.data;
  }

  async asyncResult(id: string): Promise<AsyncResultRes> {
    const res = await this.client.get(`/async-result/${id}`);
    return res.data;
  }

  public async handleCogViewX(req: ChatRequest, stream: EventStream) {
    const auto = chatModel.get(Site.Auto);
    let old = '';
    const pt = new ThroughEventStream(
      (event, data) => {
        stream.write(event, data);
        if ((data as MessageData).content) {
          old += (data as MessageData).content;
        }
      },
      async () => {
        try {
          stream.write(Event.message, { content: '\n\n' });
          const action = extractJSON<VideoGenerationsReq>(old);
          if (!action) {
            stream.write(Event.message, {
              content: 'Generate action failed',
            });
            stream.write(Event.done, { content: '' });
            stream.end();
            return;
          }
          const video = await this.videoGenerations(action);
          stream.write(Event.message, { content: `\n\n> 生成中` });
          for (let i = 0; i < 200; i++) {
            try {
              const task = await this.asyncResult(video.id);
              if (task.task_status === 'PROCESSING') {
                stream.write(Event.message, { content: `.` });
              }
              if (task.task_status === 'SUCCESS') {
                stream.write(Event.message, {
                  content: `\n> 生成完成 ✅\n> request_id: \`${video.request_id}\``,
                });
                if (!task?.video_result?.length) {
                  this.logger.error('get video url failed');
                  break;
                }
                for (const v of task.video_result) {
                  stream.write(Event.message, {
                    content: `\n\n![cover](${v.cover_image_url})\n [在线播放▶️](${v.url})`,
                  });
                }
                stream.write(Event.done, { content: '' });
                stream.end();
                break;
              }
            } catch (e: any) {
              this.logger.error(`get task list failed, err: ${e.message}`);
            }
            await sleep(3 * 1000);
          }
        } catch (e: any) {
          this.logger.error(e.message);
          stream.write(Event.message, {
            content: `生成失败: ${
              e.message
            }\nReason:\n\`\`\`json\n${JSON.stringify(
              e.response?.data,
              null,
              2,
            )}\n\`\`\`\n`,
          });
          stream.write(Event.done, { content: '' });
          stream.end();
        }
      },
    );
    req.messages = [
      { role: 'system', content: GlmCogViewXPrompt },
      ...req.messages,
    ];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.glm?.model || ModelType.GPT4_32k,
      } as ChatRequest,
      pt,
    );
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    let model = req.model;
    if (this.options?.model_map && this.options.model_map[req.model]) {
      model = this.options.model_map[req.model];
    }
    if (model === ModelType.CogVideoX) {
      await this.handleCogViewX(req, stream);
      return;
    }
    const data: RealReq = {
      ...req,
      messages: req.messages,
      model: model,
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

  dynamicRouter(router: Router): boolean {
    router.post('/videos/generations', async (ctx) => {
      const body = ctx.request.body as any;
      const res = await this.videoGenerations(body);
      this.logger.info(
        `/videos/generations,req: ${JSON.stringify(body)} res: ${JSON.stringify(
          res,
        )}`,
      );
      ctx.body = res;
    });
    router.get('/async-result/:id', async (ctx) => {
      const id = ctx.params.id;
      const res = await this.asyncResult(id);
      this.logger.info(
        `async-result, req: ${JSON.stringify(id)}, res: ${JSON.stringify(res)}`,
      );
      ctx.body = res;
    });
    return true;
  }
}
