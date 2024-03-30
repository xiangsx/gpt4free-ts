import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import { Account, Clip, SongOptions } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import {
  Event,
  EventStream,
  extractJSON,
  MessageData,
  sleep,
  ThroughEventStream,
} from '../../utils';
import { chatModel } from '../index';
import { prompt } from './prompt';
import moment from 'moment';
import Application from 'koa';

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
          if (/"title": "([^"]*)"/.test(old)) {
            titleOK = true;
            stream.write(Event.message, { content: '\n\n' });
          }
        } else if (!tagsOK) {
          const t = `*${this.extractContent('tags', old + `"`) || ''}`;
          stream.write(Event.message, { content: t.substring(tags.length) });
          tags = t;
          if (/"tags": "([^"]*)"/.test(old)) {
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
          if (/"prompt": "([^"]*)"/.test(old)) {
            lyricsOK = true;
            stream.write(Event.message, { content: '\n\n---\n\n' });
          }
        }
      },
      async () => {
        try {
          let options = extractJSON<SongOptions>(old || '');
          if (!options) {
            options = {
              title,
              tags,
              prompt: lyrics,
              mv: ModelType.ChirpV3_0,
              continue_clip_id: null,
              continue_at: null,
            };
          }
          await child.updateToken();
          const song = await child.createSong(options);
          stream.write(Event.message, {
            content: `> id\n>${song.id}\n\n生成中: 🎵`,
          });
          const completeSongs: Clip[] = [];
          let ids = song.clips.map((v) => v.id);
          for (let i = 0; i < 120; i++) {
            const clips = await child.feedSong(ids).catch((e) => {
              this.logger.error(e.message);
            });
            if (!clips) {
              await sleep(1000);
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
                stream.write(Event.message, {
                  content: `\n${v.title}\n![image](${v.image_url})\n音频🎧: [点击播放](${v.audio_url})\n视频🖥: [点击播放](${v.video_url})\n`,
                });
                break;
              case 'error':
                stream.write(Event.message, {
                  content: `\n${v.title}\n生成失败\n`,
                });
                break;
              case 'streaming':
                stream.write(Event.message, {
                  content: `\n${v.title}\n生成超时\n`,
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
          this.logger.error(`wtf error:${e.message}`);
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
}
