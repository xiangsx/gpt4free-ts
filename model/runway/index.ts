import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import {
  Account,
  GenVideoAction,
  GenVideoTaskReq,
  RunwayServerCache,
  RunwayTaskStatus,
  RunwayTaskType,
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
import { RunwayPrompt } from './prompt';
import moment from 'moment';
import {
  extractVideoLastFrame,
  mergeVideosExcludeLastFrame,
} from '../../utils/file';

export class Runway extends Chat {
  constructor(options?: ChatOptions) {
    super(options);
  }

  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'lima',
    () => Config.config.runway?.size || 0,
    (info, options) => new Child(this.options?.name || 'luma', info, options),
    (info) => {
      if (!info.email || !info.password) {
        return false;
      }
      if (info.failed && info.failed >= 10) {
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
          Config.config.runway?.accounts.map((v) => v.email) || [],
        );
        for (const v of allInfos) {
          oldInfoMap[v.email] = v;
          if (!newInfoSet.has(v.email)) {
            newInfos.push(v);
          }
        }
        for (const v of Config.config.runway?.accounts || []) {
          let old = oldInfoMap[v.email];
          if (!old) {
            old = {
              id: v4(),
              email: v.email,
              password: v.password,
              recovery: v.recovery,
            } as Account;
            if (v.token) {
              old.token = v.token;
              old.failed = 0;
            }
            newInfos.push(old);
            continue;
          }
          old.password = v.password;
          if (v.token) {
            old.token = v.token;
            old.failed = 0;
          }
          newInfos.push(old);
        }
        return newInfos;
      },
      delay: 1000,
      serial: Config.config.runway?.serial || 1,
      needDel: (info) => {
        if (!info.email || !info.password) {
          return true;
        }
        return false;
      },
    },
  );

  support(model: ModelType): number {
    if (model.startsWith('runway')) {
      return 3000;
    }
    return 0;
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
          stream.write(Event.message, { content: '\n\n' });
          const action = extractJSON<GenVideoAction>(old);
          if (!action) {
            stream.write(Event.message, {
              content: 'Generate action failed',
            });
            stream.write(Event.done, { content: '' });
            stream.end();
            return;
          }
          if (!action.image_url?.includes('http')) {
            stream.write(Event.message, {
              content: '请上传图片链接，才能开始生成视频',
            });
            stream.write(Event.done, { content: '' });
            stream.end();
            return;
          }
          action.seed = action.seed || Math.floor(Math.random() * 10000000000);
          const req: GenVideoTaskReq = {
            taskType: RunwayTaskType.gen3a_turbo,
            internal: false,
            options: {
              name: `Gen-3 Alpha Turbo ${
                action.seed
              }, ${action.user_prompt.slice(0, 20)}`,
              seconds: 10,
              text_prompt: action.user_prompt,
              seed: action.seed,
              exploreMode: false,
              watermark: true,
              enhance_prompt: action.enhance_prompt,
              init_image: action.image_url,
              resolution: '720p',
              image_as_end_frame: false,
              assetGroupName: 'Generative Video',
            },
            asTeamId: 0,
          };
          await retryFunc(
            async () => {
              const child = await this.pool.pop();
              const video = await child.genTask(req);
              let pendingOK = false;
              let processingOK = false;
              stream.write(Event.message, { content: `\n\n> 排队中` });
              for (let i = 0; i < 200; i++) {
                try {
                  const task = await child.getTask(video.task.id);
                  if (task.task.status === RunwayTaskStatus.FAILED) {
                    stream.write(Event.message, { content: '生成失败' });
                    stream.write(Event.done, { content: '' });
                    stream.end();
                    break;
                  }
                  if (
                    task.task.status === RunwayTaskStatus.PENDING &&
                    !pendingOK
                  ) {
                    stream.write(Event.message, { content: `.` });
                  }
                  if (task.task.status === RunwayTaskStatus.RUNNING) {
                    if (!pendingOK) {
                      stream.write(Event.message, { content: `\n> 生成中` });
                      pendingOK = true;
                    }
                    if (!processingOK) {
                      stream.write(Event.message, { content: `.` });
                    }
                  }
                  if (task.task.status === RunwayTaskStatus.SUCCEEDED) {
                    stream.write(Event.message, {
                      content: `\n> 生成完成 ✅`,
                    });
                    let url = task?.task.artifacts?.[0]?.url;
                    if (!url) {
                      this.logger.error('get video url failed');
                      break;
                    }
                    const dimensions =
                      task.task?.artifacts?.[0]?.metadata?.dimensions.join('x');
                    const fps = task.task?.artifacts?.[0]?.metadata?.frameRate;
                    const preurl = task.task?.artifacts?.[0]?.previewUrls?.[0];
                    stream.write(Event.message, {
                      content: `\n> 视频信息 ${dimensions} ${fps}fps\n\n![${preurl}](${preurl})\n[在线播放▶️](${url})`,
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
            Config.config.runway?.retry_times || 3,
            { label: 'runway gen video', delay: 100 },
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
    req.messages = [{ role: 'system', content: RunwayPrompt }, ...req.messages];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.runway?.model || ModelType.GPT4_32k,
      } as ChatRequest,
      pt,
    );
  }

  dynamicRouter(router: Router): boolean {
    router.post(
      '/v1/tasks',
      checkBody({
        taskType: Joi.valid(...Object.values(RunwayTaskType)).required(),
        internal: Joi.boolean().required(),
        options: Joi.object().unknown(true).required(),
      }),
      async (ctx: Application.Context) => {
        const req = ctx.request.body as GenVideoTaskReq;

        await retryFunc(
          async () => {
            const child = await this.pool.pop();
            try {
              const res = await child.genTask(req);
              await RunwayServerCache.set(res.task.id, child.info.id);
              ctx.body = { ...res, server_id: child.info.id };
            } catch (e: any) {
              throw new ComError(
                `gen video failed, message:${
                  e.message
                }, reason: ${JSON.stringify(e.response?.data)}`,
                e.response?.status,
              );
            }
          },
          Config.config.runway?.retry_times || 3,
          {},
        );
      },
    );
    router.get(
      '/v1/tasks/:id',
      checkParams(
        {
          id: Joi.string().required(),
        },
        { allowUnknown: true },
      ),
      async (ctx: Application.Context) => {
        const id = ctx.query.id as string;
        const server_id = await RunwayServerCache.get(id);
        if (!server_id) {
          throw new ComError('server_id not found', ComError.Status.NotFound);
        }
        const info = this.pool.findOne((v) => v.id === server_id);
        if (!info) {
          throw new ComError('server not found', ComError.Status.NotFound);
        }
        const child = new Child(this.options?.name || 'luma', info);
        const task = await child.getTask(id);
        ctx.body = task;
      },
    );
    return true;
  }
}
