import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import {
  Account,
  ETaskType,
  GenVideoReq,
  TaskReq,
  ViduServerCache,
} from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import Application from 'koa';
import { v4 } from 'uuid';
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
import Router from 'koa-router';
import { checkBody, checkParams, checkQuery } from '../../utils/middleware';
import Joi from 'joi';
import { chatModel } from '../index';
import { ViduPrompt } from './prompt';
import moment from 'moment';

export class Vidu extends Chat {
  constructor(options?: ChatOptions) {
    super(options);
  }

  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'vidu',
    () => Config.config.vidu?.size || 0,
    (info, options) => new Child(this.options?.name || 'vidu', info, options),
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
          Config.config.vidu?.accounts.map((v) => v.email) || [],
        );
        for (const v of allInfos) {
          oldInfoMap[v.email] = v;
          if (!newInfoSet.has(v.email)) {
            newInfos.push(v);
          }
        }
        for (const v of Config.config.vidu?.accounts || []) {
          let old = oldInfoMap[v.email];
          if (!old) {
            old = {
              id: v4(),
              email: v.email,
              password: v.password,
              recovery: v.recovery,
            } as Account;
            if (v.jwt) {
              old.cookies = [{ name: 'jwt', value: v.jwt }];
            }
            newInfos.push(old);
            continue;
          }
          old.password = v.password;
          if (v.jwt) {
            let cookie = old.cookies?.find((v) => v.name === 'jwt');
            if (cookie) {
              cookie.value = v.jwt;
            } else {
              cookie = { name: 'JWT', value: v.jwt };
            }
            old.cookies = [cookie];
          }
          newInfos.push(old);
        }
        return newInfos;
      },
      delay: 1000,
      serial: Config.config.vidu?.serial || 1,
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
      case ModelType.ViduVideo:
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
              const action = extractJSON<TaskReq>(old);
              if (!action) {
                stream.write(Event.message, {
                  content: 'Generate action failed',
                });
                stream.write(Event.done, { content: '' });
                stream.end();
                return;
              }
              const child = await this.pool.pop();
              const video = await child.tasks(action);
              let pendingOK = false;
              let processingOK = false;
              stream.write(Event.message, { content: `\n\n> 排队中` });
              for (let i = 0; i < 200; i++) {
                try {
                  const task = await Child.HistoryOne(
                    this.pool,
                    child.info.id,
                    video.id,
                  );
                  if (task.state === 'pending' && !pendingOK) {
                    stream.write(Event.message, { content: `.` });
                  }
                  if (task.state === 'processing') {
                    if (!pendingOK) {
                      stream.write(Event.message, { content: `\n> 生成中` });
                      pendingOK = true;
                    }
                    if (!processingOK) {
                      stream.write(Event.message, { content: `.` });
                    }
                  }
                  if (task.state === 'completed') {
                    stream.write(Event.message, {
                      content: `\n> 生成完成 ✅`,
                    });
                    let { url, width, height } = task?.creations?.[0]?.video;
                    if (!url) {
                      this.logger.error('get video url failed');
                      break;
                    }
                    url = await downloadAndUploadCDN(url);
                    stream.write(Event.message, {
                      content: `\n> 视频信息 ${width}x${height}\n\n[在线播放▶️](${url})`,
                    });
                    stream.write(Event.done, { content: '' });
                    stream.end();
                    break;
                  }
                } catch (e: any) {
                  this.logger.error(`get task list failed, err: ${e.message}`);
                }
                await sleep(5 * 1000);
              }
            },
            Config.config.vidu?.retry_times || 3,
            { label: 'vidu gen video', delay: 100 },
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
    req.messages = [{ role: 'system', content: ViduPrompt }, ...req.messages];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.vidu?.model || ModelType.GPT4_32k,
      } as ChatRequest,
      pt,
    );
  }

  dynamicRouter(router: Router): boolean {
    router.post(
      '/v1/tasks',
      checkBody({
        input: Joi.object({
          prompts: Joi.array()
            .items(
              Joi.object({
                type: Joi.string().valid('text', 'image').required(),
                content: Joi.string().required(),
                enhance: Joi.boolean(),
              }),
            )
            .required(),
        }).required(),
        type: Joi.string()
          .valid(...Object.values(ETaskType))
          .required(),
        settings: Joi.object({
          style: Joi.string().valid('general').required(),
          aspect_ratio: Joi.string().valid('16:9').required(),
          duration: Joi.number().integer().min(1).max(10).required(), // Assuming the duration is between 1 and 10 seconds
          model: Joi.string().valid('vidu-1').required(),
        }).required(),
      }),
      async (ctx: Application.Context) => {
        const req = ctx.request.body as TaskReq;
        await retryFunc(
          async () => {
            const child = await this.pool.pop();
            try {
              const res = await child.tasks(req);
              await ViduServerCache.set(res.id, child.info.id);
              ctx.body = { ...res, server_id: child.info.id };
            } catch (e: any) {
              throw new ComError(
                `tasks failed, message:${e.message}, reason: ${JSON.stringify(
                  e.response?.data,
                )}`,
                e.response?.status,
              );
            }
          },
          Config.config.vidu?.retry_times || 3,
          { skip: (e) => e?.status === 400 },
        );
      },
    );
    router.get(
      '/v1/tasks',
      checkQuery(
        {
          id: Joi.string().required(),
        },
        { allowUnknown: true },
      ),
      async (ctx: Application.Context) => {
        const id = ctx.query.id as string;
        const server_id =
          (ctx.query.server_id as string) || (await ViduServerCache.get(id));
        if (!server_id) {
          throw new ComError('server_id not found', ComError.Status.NotFound);
        }
        const task = await Child.HistoryOne(this.pool, server_id, id);
        ctx.body = task;
      },
    );
    router.get(
      '/v1/tasks/state',
      checkQuery(
        {
          id: Joi.string().required(),
          server_id: Joi.string().allow('').optional(),
        },
        { allowUnknown: true },
      ),
      async (ctx: Application.Context) => {
        const id = ctx.query.id as string;
        const server_id =
          (ctx.query.server_id as string) || (await ViduServerCache.get(id));
        if (!server_id) {
          throw new ComError('server_id not found', ComError.Status.NotFound);
        }
        const task = await Child.TaskState(this.pool, server_id, id);
        ctx.body = task;
      },
    );
    return true;
  }
}
