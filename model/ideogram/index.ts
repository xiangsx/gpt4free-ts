import { Chat, ChatRequest, ModelType, Site } from '../base';
import { CreateNewAxios } from '../../utils/proxyAgent';
import {
  FluxPrompt,
  FluxServerCache,
  PredictionsReq,
  PredictionsRes,
  ResultRes,
} from './define';
import {
  ComError,
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
import Joi, { func } from 'joi';
import moment from 'moment';
import { Pool } from '../../utils/pool';
import { Account } from '../flux/define';
import { Child } from '../flux/child';
import { v4 } from 'uuid';

export class Flux extends Chat {
  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'flux',
    () => Config.config.flux?.size || 0,
    (info, options) =>
      new Child(false, this.options?.name || 'flux', info, options),
    (info) => {
      if (!info.email || !info.password) {
        return false;
      }
      if (info.refresh_time && info.refresh_time > moment().unix()) {
        return false;
      }
      return true;
    },
    {
      preHandleAllInfos: async (allInfos) => {
        const newInfos: Account[] = [];
        const oldInfoMap: Record<string, Account | undefined> = {};
        const newInfoSet: Set<string> = new Set(
          Config.config.flux?.accounts.map((v) => v.email) || [],
        );
        for (const v of allInfos) {
          oldInfoMap[v.email] = v;
          if (!newInfoSet.has(v.email)) {
            newInfos.push(v);
          }
        }
        for (const v of Config.config.flux?.accounts || []) {
          let old = oldInfoMap[v.email];
          if (!old) {
            old = {
              id: v4(),
              email: v.email,
              password: v.password,
              recovery: v.recovery,
            } as Account;
            newInfos.push(old);
            continue;
          }
          old.password = v.password;
          newInfos.push(old);
        }
        return newInfos;
      },
      delay: 1000,
      serial: Config.config.flux?.serial || 1,
      needDel: (info) => {
        if (!info.email || !info.password) {
          return true;
        }
        return false;
      },
    },
  );

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
              const child = await this.pool.pop();
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
              const pRes = await child.predictions(action);
              stream.write(Event.message, { content: `\n\n> 生成中` });
              for (let i = 0; i < 10; i++) {
                try {
                  const task = await child.result(pRes.replicateId);
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
      '/v1/images/generations',
      checkBody(
        {
          prompt: Joi.string().required(),
          size: Joi.string()
            .allow('', ...allowSizeStr)
            .optional(),
        },
        { allowUnknown: true },
      ),
      async (ctx) => {
        const { prompt, size } = ctx.request.body as any;
        const [width, height] = size.split('x').map((v: string) => parseInt(v));
        await retryFunc(async () => {
          const child = await this.pool.pop();
          const result = await child.predictions({ prompt, width, height });
          for (let i = 0; i < 20; i++) {
            try {
              const task = await child.result(result.replicateId);
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
        }, 3);
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
        await retryFunc(async () => {
          const child = await this.pool.pop();
          const result = await child.predictions({
            prompt,
            width: +width,
            height: +height,
          });
          await FluxServerCache.set(result.replicateId, child.info.id);
          ctx.body = { id: result.replicateId };
        }, 3);
      },
    );
    router.get(
      '/v1/get_result',
      checkQuery({
        request_id: Joi.string().required(),
      }),
      async (ctx) => {
        const request_id = ctx.request.query.request_id as string;
        const id = await FluxServerCache.get(request_id);
        const info = this.pool.findOne((v) => v.id === id);
        if (!info) {
          throw new ComError('request_id not exist', ComError.Status.NotFound);
        }

        const child = new Child(true, this.options?.name || 'flux', info);
        const res = await child.result(request_id as string);
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
        await retryFunc(async () => {
          const child = await this.pool.pop();
          const result = await child.predictions({
            prompt,
            width: +width,
            height: +height,
          });
          for (let i = 0; i < 20; i++) {
            try {
              const task = await child.result(result.replicateId);
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
        }, 3);
      },
    );
    router.post(
      '/v1/chat',
      checkBody({ messages: Joi.string().required() }),
      async (ctx) => {
        const { messages } = ctx.request.body as any;
        await retryFunc(async () => {
          const child = await this.pool.pop();
          ctx.body = await child.chat(messages);
        }, 3);
      },
    );
    return true;
  }
}
