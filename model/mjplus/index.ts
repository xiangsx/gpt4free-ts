import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import {
  ComError,
  Event,
  EventStream,
  extractJSON,
  MessageData,
  sleep,
  ThroughEventStream,
} from '../../utils';
import { chatModel } from '../index';
import { MJPlusPrompt } from './prompt';
import { Account, BotType, ImageTool, ToolInfo, ToolType } from './define';
import { Child } from './child';
import { Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import { ComponentLabelMap } from '../midjourney/define';

export class MJPlus extends Chat {
  private pool = new Pool<Account, Child>(
    this.options?.name || '',
    () => Config.config.mjplus?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (info) => {
      if (!info.base_url) {
        return false;
      }
      if (!info.api_key) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: Config.config.mjplus?.serial || 1,
      preHandleAllInfos: async (allInfos) => {
        return (
          Config.config.mjplus?.accounts.map(
            (v) =>
              ({
                id: v4(),
                base_url: v.base_url,
                api_key: v.api_key,
              } as Account),
          ) || []
        );
      },
    },
  );
  support(model: ModelType): number {
    switch (model) {
      case ModelType.MJChat:
        return 10000;
      default:
        return 0;
    }
  }

  async imageStream(child: Child, req: ImageTool, stream: EventStream) {
    const res = await child.imagine({
      botType: BotType.MID_JOURNEY,
      prompt: req.prompt,
    });
    stream.write(Event.message, {
      content: `> 提交任务✅ \n> task_id: \`${res.result}\`\n> 生成中.`,
    });
    let last_process: string = '';
    for (let i = 0; i < 100; i++) {
      const v = await child.fetchTask(res.result);
      if (!v.progress) {
        stream.write(Event.message, { content: '.' });
        sleep(3000);
        continue;
      }
      if (v.progress === last_process) {
        stream.write(Event.message, { content: '.' });
      } else {
        stream.write(Event.message, { content: `${v.progress}` });
        last_process = v.progress;
      }
      if (v.status === 'SUCCESS') {
        stream.write(Event.message, {
          content: `
![${req.prompt}](${v.imageUrl})`,
        });
        stream.write(Event.message, {
          content: `\n\n|name|label|type|custom_id|\n|---|---|---|---|\n`,
        });
        for (const b of v.buttons) {
          const label = b.label || b.emoji;
          if (b.type === 2 && label && ComponentLabelMap[label]) {
            stream.write(Event.message, {
              content: `|${ComponentLabelMap[label]}|${label}|${b.type}|${b.customId}|\n`,
            });
          }
        }
        break;
      }

      await sleep(3000);
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    try {
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
            const action = extractJSON<ToolInfo>(old);
            if (!action) {
              stream.write(Event.message, {
                content: 'Generate action failed',
              });
              stream.write(Event.done, { content: '' });
              stream.end();
              return;
            }
            switch (action?.type) {
              case ToolType.Imagine:
                await this.imageStream(child, action as ImageTool, stream);
                break;
              default:
                stream.write(Event.done, { content: '' });
                stream.end();
                child.release();
                break;
            }
          } catch (e: any) {
            stream.write(Event.error, { error: e.message });
            stream.write(Event.done, { content: '' });
            stream.end();
          }
        },
      );
      req.messages = [
        { role: 'system', content: MJPlusPrompt },
        ...req.messages,
      ];
      await auto?.askStream(
        {
          ...req,
          model: Config.config.mjplus?.model || ModelType.GPT4_32k,
        } as ChatRequest,
        pt,
      );
    } catch (e: any) {
      child.release();
      throw new ComError(e.message);
    }
  }
}
