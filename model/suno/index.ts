import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import {
  Account,
  Clip,
  GoAmzGenReq,
  SongOptions,
  SunoServerCache,
} from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
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
import { prompt } from './prompt';
import moment from 'moment';
import Application from 'koa';
import Router from 'koa-router';
import { checkBody, checkParams, checkQuery } from '../../utils/middleware';
import Joi from 'joi';

export class Suno extends Chat {
  constructor(options?: ChatOptions) {
    super(options);
  }

  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'suno',
    () => Config.config.suno?.size || 0,
    (info, options) => new Child(this.options?.name || 'suno', info, options),
    (info) => {
      if (!info.token) {
        return false;
      }
      if (info.refresh_time && moment().unix() < info.refresh_time) {
        return false;
      }
      if (info.need_pay) {
        return false;
      }
      return true;
    },
    {
      preHandleAllInfos: async (allInfos) => {
        const oldset = new Set(allInfos.map((v) => v.token));
        for (const v of Config.config.suno?.tokens || []) {
          if (!oldset.has(v)) {
            allInfos.push({
              id: v4(),
              token: v,
            } as Account);
          }
        }
        return allInfos;
      },
      delay: 3000,
      serial: Config.config.suno?.serial || 1,
      needDel: (info) => {
        if (!info.token) {
          return true;
        }
        return false;
      },
    },
  );

  support(model: ModelType): number {
    switch (model) {
      case ModelType.SunoV3p5:
        return 10000;
      case ModelType.SunoV3:
        return 10000;
      case ModelType.SunoV2:
        return 10000;
      default:
        return 0;
    }
  }

  extractContent(key: string, str: string) {
    const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`);
    const match = str.match(regex);

    if (match) {
      return match[1]; // 返回匹配到的引号内文本
    } else {
      return null; // 如果没有找到匹配项，返回 null
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    req.messages = req.messages.filter((v) => v.role !== 'system');
    const child = await this.pool.pop();
    const auto = chatModel.get(Site.Auto);
    let old = '';
    let lastLength = 0;
    let titleOK = false;
    let title = '';
    let tagsOK = false;
    let tags = '';
    let lyricsOK = false;
    let lyrics = '';
    const pt = new ThroughEventStream(
      (event, data) => {
        if ((data as MessageData).content) {
          old += (data as MessageData).content;
        }

        if (!titleOK) {
          const t = `#### 🎵${this.extractContent('title', old + `"`) || ''}`;
          stream.write(Event.message, { content: t.substring(title.length) });
          title = t;
          if (/"title"\s*:\s*"([^"]*)"/.test(old)) {
            titleOK = true;
            stream.write(Event.message, { content: '\n\n' });
          }
        } else if (!tagsOK) {
          const t = `*${this.extractContent('tags', old + `"`) || ''}`;
          stream.write(Event.message, { content: t.substring(tags.length) });
          tags = t;
          if (/"tags"\s*:\s*"([^"]*)"/.test(old)) {
            tagsOK = true;
            stream.write(Event.message, { content: '*\n\n---\n\n' });
          }
        } else if (!lyricsOK) {
          const t = this.extractContent('prompt', old + `"`) || '';
          if (!t.endsWith(`\\`) && !t.endsWith(`\\\\`)) {
            let content = t.substring(lyrics.length);
            // 处理换行
            content = content.replace(/\\n/g, '\n');
            stream.write(Event.message, {
              content,
            });
            lyrics = t;
          }
          if (/"prompt"\s*:\s*"([^"]*)"/.test(old)) {
            lyricsOK = true;
            stream.write(Event.message, { content: '\n\n' });
          }
        }
      },
      async () => {
        try {
          if (!lyrics) {
            this.logger.warn(`lyrics is empty: ${old}`);
          }
          let options = extractJSON<SongOptions>(old || '');
          if (!options) {
            options = {
              title,
              tags,
              prompt: lyrics,
              mv:
                req.model === ModelType.SunoV3p5
                  ? ModelType.ChirpV3_5
                  : ModelType.ChirpV3_0,
              continue_clip_id: null,
              continue_at: null,
            };
          }
          options.mv =
            req.model === ModelType.SunoV3p5
              ? ModelType.ChirpV3_5
              : ModelType.ChirpV3_0;
          if (!lyrics) {
            stream.write(Event.message, {
              content: `\n${options.prompt}\n---\n`,
            });
          }
          await child.updateToken();
          const song = await retryFunc(() => child.createSong(options!), 3, {
            delay: 0,
          });
          stream.write(Event.message, {
            content: `\n> id\n>${song.id}\n等待中: 🎵`,
          });
          const completeSongs: Clip[] = [];
          let ids = song.clips.map((v) => v.id);
          let streaming = false;
          for (let i = 0; i < 120; i++) {
            const res = await child.feedSong(ids).catch((e) => {
              this.logger.error(e.message);
            });
            if (!res) {
              await sleep(1000);
              continue;
            }
            const { clips } = res;
            if (!streaming && clips.every((v) => v.status === 'streaming')) {
              stream.write(Event.message, {
                content: '\n\n***音乐正在生成中, 可以边播边生成***\n',
              });
              for (const i in clips) {
                const v = clips[i];
                stream.write(Event.message, {
                  content: `\n音频${+i + 1}🎧: [点击播放](${v.audio_url})\n`,
                });
              }
              stream.write(Event.message, {
                content: '\n> 等待完整音乐生成: 🎵',
              });
              streaming = true;
              continue;
            }
            completeSongs.push(...clips.filter((v) => v.status === 'complete'));
            if (
              clips.every(
                (v) => v.status === 'complete' || v.status === 'error',
              )
            ) {
              break;
            }
            ids = clips.filter((v) => v.status !== 'complete').map((v) => v.id);
            stream.write(Event.message, {
              content: `🎵`,
            });
            this.logger.debug(
              `waiting for clips: ${clips
                .map((v) => `${v.id}: ${v.status}`)
                .join(',')}`,
            );
            if (i > 50) {
              this.logger.warn(`wtf ${i}/100,clips:${JSON.stringify(clips)}`);
            }
            await sleep(5 * 1000);
          }
          for (const v of completeSongs) {
            switch (v.status) {
              case 'complete':
                const [image_url, audio_url, video_url] = await Promise.all(
                  [v.image_url, v.audio_url, v.video_url].map(async (url) =>
                    url ? await downloadAndUploadCDN(url) : url,
                  ),
                );
                stream.write(Event.message, {
                  content: `\n\n${v.title}\n![image](${image_url})\n音频🎧: [点击播放](${audio_url})\n视频🖥: [点击播放](${video_url})\n`,
                });
                break;
              case 'error':
                stream.write(Event.message, {
                  content: `\n\n${v.title}\n生成失败\n`,
                });
                break;
              case 'streaming':
                stream.write(Event.message, {
                  content: `\nn${v.title}\n生成超时\n`,
                });
                break;
              default:
                break;
            }
          }
          stream.write(Event.done, { content: '' });
          stream.end();
          await child.updateCredit();
        } catch (e: any) {
          stream.write(Event.message, {
            content: `${e.message}: ${
              e.response?.data && JSON.stringify(e.response.data)
            }`,
          });
          stream.write(Event.done, { content: '' });
          stream.end();
          this.logger.error(
            `wtf error:${e.message} ${
              e.response?.data && JSON.stringify(e.response.data)
            }`,
          );
        }
      },
    );
    await auto?.askStream(
      {
        model: Config.config.suno?.model || ModelType.GPT4_32k,
        messages: [{ role: 'system', content: prompt }, ...req.messages],
      } as ChatRequest,
      pt,
    );
  }

  async createSong(ctx: Application.Context, req: SongOptions) {
    const child = await this.pool.pop();
    const res = await child.createSong(req);
    ctx.body = { server_id: child.info.id, ...res };
  }

  async feedSong(
    ctx: Application.Context,
    req: { ids: string[]; server_id: string },
  ) {
    const child = await this.pool.popIf((v) => v.id === req.server_id);
    ctx.body = await child.feedSong(req.ids);
  }

  dynamicRouter(router: Router) {
    router.post(
      '/goamz/generate',
      (ctx) =>
        (ctx.request.body as GoAmzGenReq)?.custom_mode
          ? checkBody({
              custom_mode: Joi.boolean().required(),
              mv: Joi.string()
                .valid(ModelType.ChirpV3_0, ModelType.ChirpV3_5)
                .required(),
              input: Joi.object({
                prompt: Joi.string().optional(),
                gpt_description_prompt: Joi.string().optional(),
                make_instrumental: Joi.boolean().optional(),
              }).required(),
            })
          : checkBody(
              {
                custom_mode: Joi.boolean().required(),
                mv: Joi.string()
                  .valid(ModelType.ChirpV3_0, ModelType.ChirpV3_5)
                  .required(),
                input: Joi.object({
                  infill_start_s: Joi.number().allow(null).optional(),
                  infill_end_s: Joi.number().allow(null).optional(),
                  continue_at: Joi.number().allow(null).required(),
                  continue_clip_id: Joi.string().allow(null).required(),
                  prompt: Joi.string().allow('').optional(),
                  tags: Joi.string().required(),
                  title: Joi.string().required(),
                }).required(),
              },
              { allowUnknown: true },
            ),
      async (ctx) => {
        const req = ctx.request.body as GoAmzGenReq;
        ctx.body = await retryFunc(
          async () => {
            const child = await this.pool.pop();
            const opt: SongOptions = {
              mv: req.mv,
              ...req.input,
            };
            const res = await child.createSong(opt);
            await SunoServerCache.set(res.id, child.info.id);
            return {
              code: 200,
              data: { ...res, input: JSON.stringify(req.input), id: res.id },
              messages: 'success',
            } as { code: number; messages: string };
          },
          3,
          { defaultV: { code: 500, messages: 'error' } },
        );
      },
    );

    router.get(
      '/goamz/music/:id',
      checkParams({ id: Joi.string().required() }),
      async (ctx) => {
        const id = ctx.params.id;
        const server_id = await SunoServerCache.get(id);
        if (!server_id) {
          throw new Error('lyrics task not found');
        }
        const child = await this.pool.popIf((v) => v.id === server_id);
        ctx.body = await child.feedSong([id]);
      },
    );

    router.get(
      '/goamz/lyrics',
      checkBody({ prompt: Joi.string().allow('').optional() }),
      async (ctx) => {
        const prompt = ctx.query.prompt as string;
        const child = await this.pool.pop();
        const res = await child.lyrics(prompt);
        await SunoServerCache.set(res.id, child.info.id);
        ctx.body = res;
      },
    );
    router.get(
      '/goamz/lyrics/:id',
      checkParams({ id: Joi.string().required() }),
      async (ctx) => {
        const id = ctx.params.id;
        const server_id = await SunoServerCache.get(id);
        if (!server_id) {
          throw new Error('lyrics task not found');
        }
        const child = await this.pool.popIf((v) => v.id === server_id);
        ctx.body = await child.lyricsTask(id);
      },
    );

    router.post(
      '/generate',
      checkBody({
        prompt: Joi.string().allow('').required(),
        tags: Joi.string().optional(),
        mv: Joi.string().required(),
        title: Joi.string().optional(),
        continue_clip_id: Joi.string().allow(null).optional(),
        continue_at: Joi.number().allow(null).optional(),
        infill_start_s: Joi.number().allow(null).optional(),
        infill_end_s: Joi.number().allow(null).optional(),
        gpt_description_prompt: Joi.string().optional(),
        make_instrumental: Joi.boolean().optional(),
      }),
      async (ctx) => {
        const req = ctx.request.body as SongOptions;
        let server_id: string | null = null;
        if (req.continue_clip_id) {
          server_id = await SunoServerCache.get(req.continue_clip_id);
        }
        const res = await retryFunc(
          async () => {
            const child = server_id
              ? await this.pool.popIf((v) => v.id === server_id)
              : await this.pool.pop();
            const res = await child.createSong(req);
            const [id1, id2] = res.clips.map((v) => v.id);
            await SunoServerCache.set(id1, child.info.id);
            await SunoServerCache.set(id2, child.info.id);
            return res;
          },
          3,
          {},
        );
        ctx.body = res;
      },
    );

    router.get(
      '/feed',
      checkQuery({
        ids: Joi.string().required(),
      }),
      async (ctx) => {
        const req = ctx.request.query as { ids: string };
        const ids = req.ids.split(',');
        const [id] = ids;
        const server_id = await SunoServerCache.get(id);
        const child = await this.pool.popIf((v) => v.id === server_id);
        ctx.body = await child.feedSong(ids);
      },
    );

    router.post(
      '/generate/lyrics',
      checkBody({ prompt: Joi.string().required() }),
      async (ctx) => {
        const { prompt } = ctx.request.body as any;
        await retryFunc(async () => {
          const child = await this.pool.pop();
          const res = await child.lyrics(prompt);
          await SunoServerCache.set(res.id, child.info.id);
          ctx.body = res;
        }, 3);
      },
    );

    router.post(
      '/generate/concat/v2',
      checkBody({ clip_id: Joi.string().required() }, { allowUnknown: true }),
      async (ctx) => {
        const { clip_id } = ctx.request.body as any;
        const server_id = await SunoServerCache.get(clip_id);
        if (!server_id) {
          throw new Error('clip_id task not found');
        }
        await retryFunc(async () => {
          const child = await this.pool.pop();
          const res = await child.wholeSong(clip_id);
          await SunoServerCache.set(res.id, child.info.id);
          ctx.body = res;
        }, 3);
      },
    );

    router.get(
      '/generate/lyrics/:id',
      checkQuery({ id: Joi.string().required() }),
      async (ctx) => {
        const id = ctx.params.id;
        const server_id = await SunoServerCache.get(id);
        if (!server_id) {
          throw new Error('lyrics task not found');
        }
        const child = await this.pool.popIf((v) => v.id === server_id);
        ctx.body = await child.lyricsTask(id);
      },
    );

    router.post(
      '/uploads/audio',
      checkBody({
        url: Joi.string().required(),
      }),
      async (ctx) => {
        const { url } = ctx.request.body as any;
        const child = await this.pool.pop();
        const res = await child.uploadFile(url);
        await SunoServerCache.set(res.clip_id, child.info.id);
        ctx.body = res;
      },
    );
    return true;
  }
}
