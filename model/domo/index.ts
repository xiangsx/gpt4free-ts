import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  ModelType,
  Site,
} from '../base';
import { Pool } from '../../utils/pool';
import { Child } from './child';
import {
  Account,
  AIAction,
  AIActionType,
  ComponentLabelMap,
  DomoSpeedMode,
} from './define';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import {
  ComError,
  downloadAndUploadCDN,
  Event,
  EventStream,
  extractHttpImageFileURLs,
  extractHttpVideoFileURLs,
  extractJSON,
  MessageData,
  ThroughEventStream,
} from '../../utils';
import { chatModel } from '../index';
import { clearInterval } from 'timers';
import { MJPrompt } from './prompt';
import {
  GatewayDMessageCreate,
  GatewayEventName,
  getAllComponents,
} from '../discord/define';

export class Domo extends Chat {
  private pool = new Pool<Account, Child>(
    this.options?.name || '',
    () => Config.config.domo.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (info) => {
      if (!info.token) {
        return false;
      }
      if (!info.server_id) {
        return false;
      }
      if (!info.channel_id) {
        return false;
      }
      if (
        info.mode !== DomoSpeedMode.Relax &&
        info.profile &&
        info.profile.paidCreditsBalance === 0
      ) {
        return false;
      }
      return true;
    },
    {
      delay: 3000,
      serial: () => Config.config.domo.serial,
      preHandleAllInfos: async (allInfos) => {
        const channelIDSet = new Set(allInfos.map((v) => v.channel_id));
        const result: Account[] = allInfos;
        for (const info of Config.config.domo.accounts) {
          if (channelIDSet.has(info.channel_id)) {
            Object.assign(
              info,
              allInfos.find((v) => v.channel_id === info.channel_id),
            );
            continue;
          }
          result.push({
            id: v4(),
            token: info.token,
            server_id: info.server_id,
            channel_id: info.channel_id,
            mode: info.mode || DomoSpeedMode.Fast,
          } as Account);
        }
        return result;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.DomoImgToVideo:
        return 1000;
      case ModelType.DomoVideoToVideo:
        return 1000;
      case ModelType.DomoChatGen:
        return 28000;
      case ModelType.DomoChatAnimate:
        return 28000;
      default:
        return 0;
    }
  }

  async handleComponents(
    e: GatewayDMessageCreate,
    child: Child,
    stream: EventStream,
  ) {
    const components = getAllComponents(e.components);
    // const urls = await this.doMultiComponents(
    //   child,
    //   e.id,
    //   components
    //     .filter((v) => v.label?.startsWith('U') || false)
    //     .map((v) => v.custom_id),
    // );
    // stream.write(Event.message, {
    //   content:
    //     urls.map((v, idx) => `[下载${idx + 1}](${v})`).join(' ') + '\n\n',
    // });
    if (components?.length) {
      stream.write(Event.message, {
        content: `|name|label|type|custom_id|\n|---|---|---|---|\n`,
      });
      for (const b of components) {
        // if (b.label?.startsWith('U')) {
        //   continue;
        // }
        const label = b.label || b.emoji?.name;
        if (b.type === 2 && label && ComponentLabelMap[label]) {
          b.name = ComponentLabelMap[label];
          stream.write(Event.message, {
            content: `|${b.name}${b.style === 3 ? '☑️' : ''}|${label}|${
              b.type
            }|${b.custom_id}|\n`,
          });
        }
      }
    }
  }

  async gen(
    action: AIAction,
    child: Child,
    stream: EventStream,
    onEnd: () => void,
  ) {
    let itl: NodeJS.Timeout;
    await child.gen(action.prompt!, {
      model: action.model,
      image_url: action.image_url,
      onStart: (e) => {
        stream.write(Event.message, { content: '> 开始绘制' });
        itl = setInterval(() => {
          stream.write(Event.message, { content: `.` });
        }, 3000);
      },
      onEnd: async (e) => {
        clearInterval(itl);
        const url = await downloadAndUploadCDN(e.attachments[0]?.url);
        stream.write(Event.message, {
          content: `[100%](${url})\n\n`,
        });
        stream.write(Event.message, {
          content: `![${action.prompt}](${url})\n[⏬下载](${url.replace(
            '/cdn/',
            '/cdn/download/',
          )})\n\n`,
        });
        stream.write(Event.message, {
          content: `> reference_prompt: ${action.prompt}\n\n`,
        });
        await this.handleComponents(e, child, stream);
        stream.write(Event.message, {
          content: '\n **接下来你可以直接对我说命令，例如：帮我放大第一张图**',
        });
        stream.write(Event.done, { content: '' });
        stream.end();
        onEnd();
      },
      onError: (e) => {
        clearInterval(itl);
        stream.write(Event.message, {
          content: e.message,
        });
        stream.write(Event.done, { content: '' });
        stream.end();
        onEnd();
      },
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    if (req.model === ModelType.DomoImgToVideo) {
      return this.imgToVideo(req, stream);
    }
    if (req.model === ModelType.DomoVideoToVideo) {
      return this.videoToVideo(req, stream);
    }
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
            const action = extractJSON<AIAction>(old);
            if (!action) {
              stream.write(Event.message, {
                content: 'Generate action failed',
              });
              stream.write(Event.done, { content: '' });
              stream.end();
              return;
            }
            switch (action?.type) {
              // case AIActionType.Imagine:
              //   this.logger.info(child.info.channel_id);
              //   await this.imagine(action, child, stream, () =>
              //     child.release(),
              //   );
              //   return;
              case AIActionType.Component:
                try {
                  const newChild = await this.pool.popIf(
                    (v) => v.channel_id === action.channel_id,
                  );
                } catch (e) {
                  stream.write(Event.message, {
                    content: '该图像处理服务器已掉线',
                  });
                  stream.write(Event.done, { content: '' });
                  stream.end();
                }
                return;
              case AIActionType.Gen:
                await this.gen(action, child, stream, () => child.release());
                return;
              case AIActionType.Animate:
                return;
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
      await auto?.askStream(
        {
          ...req,
          messages: [{ role: 'system', content: MJPrompt }, ...req.messages],
          model: ModelType.GPT4_32k,
        } as ChatRequest,
        pt,
      );
    } catch (e: any) {
      child.release();
      throw new ComError(e.message);
    }
  }

  async imgToVideo(req: ChatRequest, stream: EventStream): Promise<void> {
    const image = extractHttpImageFileURLs(
      contentToString(req.messages[req.messages.length - 1].content),
    )?.[0];
    if (!image) {
      throw new ComError('no image url');
    }

    const child = await this.pool.pop();
    const msg1 = await child.animate(image);
    stream.write(Event.message, { content: '✅已接收到参数\n' });
    const componentStyle = getAllComponents(msg1.d.components).find((v) =>
      v.label?.includes('Intensity: low'),
    );
    if (!componentStyle) {
      throw new Error('no component');
    }
    await child.doComponent(msg1.d.id, componentStyle);
    stream.write(Event.message, { content: '✅已设置变化强度：low\n' });
    const componentTime = getAllComponents(msg1.d.components).find((v) =>
      v.label?.includes('Gen 5s'),
    );
    if (!componentTime) {
      throw new Error('no component');
    }
    await child.doComponent(msg1.d.id, componentTime);
    stream.write(Event.message, { content: '✅已设置生成时长：5s\n' });
    const componentStart = getAllComponents(msg1.d.components).find((v) =>
      v.label?.includes('Start'),
    );
    if (!componentStart) {
      throw new Error('no component');
    }
    await child.doComponent(msg1.d.id, componentStart);
    stream.write(Event.message, { content: '⏳生成中，请稍等...' });
    const placeholder = msg1.d.attachments?.[0].placeholder;
    const itl = setInterval(() => {
      stream.write(Event.message, { content: '.' });
    }, 3000);
    const msg2 = await child.waitGatewayEventNameAsync<GatewayDMessageCreate>(
      GatewayEventName.MESSAGE_UPDATE,
      (v) => {
        this.logger.info('======', v.d.attachments?.[1]?.placeholder);
        return v.d.attachments?.[1]?.placeholder === placeholder;
      },
      { timeout: 10 * 60 * 1000 },
    );
    stream.write(Event.message, { content: '\n✅生成完成\n' });
    const local_url = await downloadAndUploadCDN(
      msg2.d.attachments?.[0]?.proxy_url,
    );
    stream.write(Event.message, {
      content: `[在线播放](${local_url})\n`,
    });
    stream.write(Event.message, {
      content: `⏬[下载](${local_url.replace('/cdn/', '/cdn/download/')})\n`,
    });
    stream.write(Event.done, { content: '' });
    stream.end();
    clearInterval(itl);
  }

  async videoToVideo(req: ChatRequest, stream: EventStream): Promise<void> {
    const video_url = extractHttpVideoFileURLs(
      contentToString(req.messages[req.messages.length - 1].content),
    )?.[0];
    if (!video_url) {
      throw new ComError('no image url');
    }

    const child = await this.pool.pop();
    const msg1 = await child.video(video_url, 'green background');
    stream.write(Event.message, { content: '✅已接收到参数\n' });
    const componentStyle = getAllComponents(msg1.d.components).find((v) =>
      v.label?.includes('Intensity: low'),
    );
    if (!componentStyle) {
      throw new Error('no component');
    }
    await child.doComponent(msg1.d.id, componentStyle);
    stream.write(Event.message, { content: '✅已设置变化强度：low\n' });
    const componentTime = getAllComponents(msg1.d.components).find((v) =>
      v.label?.includes('Gen 5s'),
    );
    if (!componentTime) {
      throw new Error('no component');
    }
    await child.doComponent(msg1.d.id, componentTime);
    stream.write(Event.message, { content: '✅已设置生成时长：5s\n' });
    const componentStart = getAllComponents(msg1.d.components).find((v) =>
      v.label?.includes('Start'),
    );
    if (!componentStart) {
      throw new Error('no component');
    }
    await child.doComponent(msg1.d.id, componentStart);
    stream.write(Event.message, { content: '⏳生成中，请稍等...' });
    const placeholder = msg1.d.attachments?.[0].placeholder;
    const itl = setInterval(() => {
      stream.write(Event.message, { content: '.' });
    }, 3000);
    const msg2 = await child.waitGatewayEventNameAsync<GatewayDMessageCreate>(
      GatewayEventName.MESSAGE_UPDATE,
      (v) => {
        this.logger.info('======', v.d.attachments?.[1]?.placeholder);
        return v.d.attachments?.[1]?.placeholder === placeholder;
      },
      { timeout: 10 * 60 * 1000 },
    );
    stream.write(Event.message, { content: '\n✅生成完成\n' });
    const local_url = await downloadAndUploadCDN(
      msg2.d.attachments?.[0]?.proxy_url,
    );
    stream.write(Event.message, {
      content: `[在线播放](${local_url})\n`,
    });
    stream.write(Event.message, {
      content: `⏬[下载](${local_url.replace('/cdn/', '/cdn/download/')})\n`,
    });
    stream.write(Event.done, { content: '' });
    stream.end();
    clearInterval(itl);
  }
}
