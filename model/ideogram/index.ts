import { Chat, ChatRequest, ModelType, Site } from '../base';
import {
  Account,
  ideogram,
  IdeogramPrompt,
  ModelVersion,
  PredictionsReq,
  StyleExpert,
} from './define';
import {
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
import { checkBody } from '../../utils/middleware';
import Joi from 'joi';
import moment from 'moment';
import { Pool } from '../../utils/pool';
import { v4 } from 'uuid';
import { Child } from './child';

export class Ideogram extends Chat {
  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'ideogram',
    () => Config.config.ideogram?.size || 0,
    (info, options) =>
      new Child(false, this.options?.name || 'ideogram', info, options),
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
          Config.config.ideogram?.accounts.map((v) => v.email) || [],
        );
        for (const v of allInfos) {
          oldInfoMap[v.email] = v;
          if (!newInfoSet.has(v.email)) {
            newInfos.push(v);
          }
        }
        for (const v of Config.config.ideogram?.accounts || []) {
          let old = oldInfoMap[v.email];
          if (!old) {
            old = {
              id: v4(),
              ...v,
            } as Account;
            newInfos.push(old);
            continue;
          }
          Object.assign(old, v);
          newInfos.push(old);
        }
        return newInfos;
      },
      delay: 1000,
      serial: Config.config.ideogram?.serial || 1,
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
      case ModelType.Ideogram:
        return 2000;
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
              const action = extractJSON<ideogram.Action>(old);
              if (!action) {
                stream.write(Event.message, {
                  content: 'Generate action failed',
                });
                stream.write(Event.done, { content: '' });
                stream.end();
                return;
              }
              let [w, h] = action.size.split('x');
              const pRes = await child.ImagesSample({
                prompt: action.prompt,
                model_version: ModelVersion.V_1_5,
                use_autoprompt_option: 'ON',
                sampling_speed: 0,
                style_expert: action.style || StyleExpert.AUTO,
                resolution: {
                  width: +w || 1024,
                  height: +h || 1024,
                },
              });
              stream.write(Event.message, { content: `\n\n> 生成中` });
              for (let i = 0; i < 50; i++) {
                let task: ideogram.GalleryRetrieveRes | null = null;
                try {
                  task = await child.GalleryRetrieveRequests([pRes.request_id]);
                  if (task?.sampling_requests?.[0]?.responses?.length) {
                    stream.write(Event.message, {
                      content: `✅\n\n${task.sampling_requests[0].responses
                        .map((v) => `>![${v.url}](${v.url})\n>${v.prompt}`)
                        .join('\n\n')}`,
                    });
                    stream.write(Event.done, { content: '' });
                    stream.end();
                    break;
                  }
                  stream.write(Event.message, { content: '.' });
                } catch (e: any) {
                  this.logger.error(
                    `get task list failed, err: ${
                      e.message
                    }, task:${JSON.stringify(task)}`,
                  );
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
    req.messages = [
      { role: 'system', content: IdeogramPrompt },
      ...req.messages,
    ];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.ideogram?.model || ModelType.GPT4oMini,
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
          const result = await child.ImagesSample({
            prompt: prompt,
            model_version: ModelVersion.V_1_5,
            use_autoprompt_option: 'ON',
            sampling_speed: 0,
            style_expert: StyleExpert.AUTO,
            resolution: {
              width,
              height,
            },
          });
          for (let i = 0; i < 20; i++) {
            try {
              const task = await child.GalleryRetrieveRequests([
                result.request_id,
              ]);
              if (task?.sampling_requests?.[0]?.responses?.length) {
                ctx.body = {
                  created: moment().unix(),
                  data: task.sampling_requests[0].responses.map((v) => ({
                    url: v.url,
                  })),
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
    return true;
  }
}
