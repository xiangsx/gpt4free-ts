import { Chat, ChatRequest, ModelType, Site } from '../base';
import { CreateNewAxios } from '../../utils/proxyAgent';
import {
  FluxPrompt,
  PredictionsReq,
  PredictionsRes,
  ResultRes,
} from './define';
import {
  downloadAndUploadCDN,
  Event,
  EventStream,
  extractJSON,
  MessageData,
  retryFunc,
  sleep,
  ThroughEventStream,
} from '../../utils';
import { chatModel } from '../index';
import { Config } from '../../utils/config';
import Router from 'koa-router';
import { checkBody, checkParams, checkQuery } from '../../utils/middleware';
import Joi from 'joi';
import moment from 'moment';

export class Flux extends Chat {
  get client() {
    return CreateNewAxios({ baseURL: 'https://flux1.ai/api' }, { proxy: true });
  }

  async chat(messages: string) {
    return (await this.client.post<{ data: string }>('/chat', { messages }))
      .data;
  }

  async predictions(req: PredictionsReq) {
    return (await this.client.post<PredictionsRes>('/predictions', req)).data;
  }

  async result(id: string) {
    const { data } = await this.client.get<ResultRes>(`/result/${id}`);
    if (data.imgAfterSrc) {
      data.imgAfterSrc = await downloadAndUploadCDN(data.imgAfterSrc);
    }
    return data;
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Flux:
        return 1000;
      default:
        return 0;
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
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
          await retryFunc(
            async () => {
              stream.write(Event.message, { content: '\n\n' });
              const action = extractJSON<PredictionsReq>(old);
              if (!action) {
                stream.write(Event.message, {
                  content: 'Generate action failed',
                });
                stream.write(Event.done, { content: '' });
                stream.end();
                return;
              }
              const pRes = await this.predictions(action);
              stream.write(Event.message, { content: `\n\n> 生成中` });
              for (let i = 0; i < 10; i++) {
                try {
                  const task = await this.result(pRes.replicateId);
                  if (task.status === 1) {
                    stream.write(Event.message, {
                      content: `✅\n\n![${task.imgAfterSrc}](${task.imgAfterSrc})`,
                    });
                    stream.write(Event.done, { content: '' });
                    stream.end();
                    break;
                  }
                  stream.write(Event.message, { content: '.' });
                } catch (e: any) {
                  this.logger.error(`get task list failed, err: ${e.message}`);
                }
                await sleep(2 * 1000);
              }
            },
            Config.config.luma?.retry_times || 3,
            { label: 'luma gen video', delay: 100 },
          );
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
    req.messages = [{ role: 'system', content: FluxPrompt }, ...req.messages];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.flux?.model || ModelType.GPT4oMini,
      } as ChatRequest,
      pt,
    );
  }

  dynamicRouter(router: Router): boolean {
    const allowSize = ['256', '512', '1024', '1280', '1440'];
    // size格式widthxheight
    const allowSizeStr: string[] = [];
    for (const size of allowSize) {
      for (const size2 of allowSize) {
        allowSizeStr.push(`${size}x${size2}`);
      }
    }
    router.post(
      '/v1/image/generations',
      checkBody({
        prompt: Joi.string().required(),
        size: Joi.string()
          .allow('', ...allowSizeStr)
          .optional(),
      }),
      async (ctx) => {
        const { prompt, size } = ctx.request.body as any;
        const [width, height] = size.split('x').map((v: string) => parseInt(v));
        const result = await this.predictions({ prompt, width, height });
        for (let i = 0; i < 20; i++) {
          try {
            const task = await this.result(result.replicateId);
            if (task.status === 1) {
              ctx.body = {
                created: moment().unix(),
                data: [{ url: task.imgAfterSrc }],
              };
              return;
            }
          } catch (e: any) {
            this.logger.error(`get task list failed, err: ${e.message}`);
          }
          await sleep(2 * 1000);
        }
        throw new Error('task timeout');
      },
    );
    router.post(
      '/v1/image',
      checkBody({
        prompt: Joi.string().required(),
        width: Joi.number()
          .allow(...allowSize)
          .optional(),
        height: Joi.number()
          .allow(...allowSize)
          .optional(),
      }),
      async (ctx) => {
        const { prompt, width, height } = ctx.request.body as any;
        const result = await this.predictions({
          prompt,
          width: +width,
          height: +height,
        });
        ctx.body = { id: result.replicateId };
      },
    );
    router.get(
      '/v1/get_result',
      checkQuery({
        request_id: Joi.string().required(),
      }),
      async (ctx) => {
        const request_id = ctx.request.query.request_id;
        const res = await this.result(request_id as string);
        ctx.body = {
          id: request_id,
          status: res.status === 1 ? 'Ready' : 'Pending',
          result: res.imgAfterSrc,
        };
      },
    );
    router.post(
      '/v1/image/auto',
      checkBody({
        prompt: Joi.string().required(),
        width: Joi.number().optional(),
        height: Joi.number().optional(),
      }),
      async (ctx) => {
        const { prompt, width, height } = ctx.request.body as any;
        const result = await this.predictions({
          prompt,
          width: +width,
          height: +height,
        });
        for (let i = 0; i < 20; i++) {
          try {
            const task = await this.result(result.replicateId);
            if (task.status === 1) {
              ctx.body = {
                url: task.imgAfterSrc,
              };
              return;
            }
          } catch (e: any) {
            this.logger.error(`get task list failed, err: ${e.message}`);
          }
          await sleep(2 * 1000);
        }
      },
    );
    router.post(
      '/v1/chat',
      checkBody({ messages: Joi.string().required() }),
      async (ctx) => {
        const { messages } = ctx.request.body as any;
        ctx.body = await this.chat(messages);
      },
    );
    return true;
  }
}
