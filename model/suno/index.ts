import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import { Account, Clip, SongOptions } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import { ComError, Event, EventStream, extractJSON, sleep } from '../../utils';
import { chatModel } from '../index';
import { prompt } from './prompt';

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

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    const auto = chatModel.get(Site.Auto);
    const res = await auto?.ask({
      model: Config.config.suno?.model || ModelType.GPT4_32k,
      messages: [{ role: 'system', content: prompt }, ...req.messages],
    } as ChatRequest);
    if (!res?.content) {
      throw new ComError('Song prompt gen failed', ComError.Status.BadRequest);
    }
    const options = extractJSON<SongOptions>(res.content);
    if (!options) {
      throw new ComError('Song prompt gen failed', ComError.Status.BadRequest);
    }
    stream.write(Event.message, {
      content: `#### 🎵${options.title}\n\n*${options.tags}*\n\n---\n\n${options.prompt}\n\n`,
    });
    const song = await child.createSong(options);
    stream.write(Event.message, {
      content: `> id\n>${song.id}\n\n生成中: 🎵`,
    });
    const completeSongs: Clip[] = [];
    let ids = song.clips.map((v) => v.id);
    for (let i = 0; i < 100; i++) {
      const clips = await child.feedSong(ids).catch((e) => {
        this.logger.error(e.message);
      });
      if (!clips) {
        await sleep(1000);
        continue;
      }
      completeSongs.push(
        ...clips.filter((v) => v.status === 'complete' && v.audio_url),
      );
      if (clips.every((v) => v.status === 'complete')) {
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
      await sleep(5 * 1000);
    }
    for (const v of completeSongs) {
      stream.write(Event.message, {
        content: `\n${v.title}\n![image](${v.image_url})\n音频🎧：[点击播放](${v.audio_url})\n视频🖥: [点击播放](${v.video_url})\n`,
      });
    }
    stream.write(Event.done, { content: '' });
    stream.end();
  }
}
