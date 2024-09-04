import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  ModelType,
} from '../base';
import { Pool } from '../../utils/pool';
import { Account } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import Application from 'koa';
import { CreateVideoTaskRequest, QueryVideoTaskRequest } from '../define';
import { v4 } from 'uuid';
import { downloadAndUploadCDN, Event, EventStream } from '../../utils';

export class Pika extends Chat {
  constructor(options?: ChatOptions) {
    super(options);
  }

  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'pika',
    () => Config.config.pika?.size || 0,
    (info, options) => new Child(this.options?.name || 'pika', info, options),
    (info) => {
      if (!info.email || !info.password) {
        return false;
      }
      return true;
    },
    {
      preHandleAllInfos: async (allInfos) => {
        const oldset = new Set(allInfos.map((v) => v.email));
        for (const v of Config.config.pika?.accounts || []) {
          if (!oldset.has(v.email)) {
            allInfos.push({
              id: v4(),
              email: v.email,
              password: v.password,
              recovery: v.recovery,
            } as Account);
          }
        }
        return allInfos;
      },
      delay: 3000,
      serial: Config.config.pika?.serial || 1,
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
      case ModelType.PikaTextToVideo:
        return 1000;
      default:
        return 0;
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    switch (req.model) {
      case ModelType.PikaTextToVideo:
        return this.textToVideo(req, stream);
    }
  }

  async textToVideo(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    try {
      const lastMsg = contentToString(
        req.messages[req.messages.length - 1].content,
      );
      const id = await child.generate(lastMsg);
      const [cid, vid] = id.split('|');
      stream.write(Event.message, {
        content: `✅成功创建视频任务：${id}\n\n`,
      });
      stream.write(Event.message, {
        content: `⌛️视频生成中...`,
      });
      const itl = setInterval(async () => {
        const video = await child.myLibrary(vid);
        if (!video) {
          stream.write(Event.message, {
            content: `.`,
          });
          return;
        }
        const v = video.data.results[0]?.videos[0];
        if (!v) {
          return;
        }
        if (v.status === 'pending') {
          stream.write(Event.message, {
            content: `.`,
          });
          return;
        }
        if (v.status === 'finished' && v.resultUrl) {
          const local_url = await downloadAndUploadCDN(v.resultUrl);
          stream.write(Event.message, {
            content: `✅视频生成成功\n\n[${
              req.prompt
            }](${local_url})\n[⏬下载](${local_url.replace(
              '/cdn/',
              '/cdn/download/',
            )})\n\n`,
          });
          // @ts-ignore
          clearInterval(itl);
          stream.write(Event.done, { content: '' });
          stream.end();
          return;
        }
      }, 3000);
    } catch (e: any) {
      if (e.response.status === 401) {
        child.destroy({ delFile: true, delMem: true });
      }
      throw e;
    }
  }

  async createVideoTask(
    ctx: Application.Context,
    req: CreateVideoTaskRequest,
  ): Promise<void> {
    const child = await this.pool.pop();
    const id = await child.generate(req.prompt || '');
    ctx.body = { id };
  }

  async queryVideoTask(
    ctx: Application.Context,
    req: QueryVideoTaskRequest,
  ): Promise<void> {
    const [child_id, id] = req.id.split('|');
    const child = await this.pool.popIf((v) => v.id === child_id);
    ctx.body = { url: await child.myLibrary(id) };
  }
}
