import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { ComError, Event, EventStream } from '../../utils';
import { Config } from '../../utils/config';
import { Pool } from '../../utils/pool';
import { v4 } from 'uuid';
import { Account, FocusType, PerplexityChatRequest } from './define';
import { Child } from './child';

export class PerAuto extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.perauto?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return true;
    },
    {
      delay: 2000,
      serial: () => Config.config.perauto?.serial || 1,
      preHandleAllInfos: async (allInfos) => {
        const oldset = new Set(allInfos.map((v) => v.email));
        for (const v of Config.config.perauto?.accounts || []) {
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
      needDel: (info) => {
        if (!info.email || !info.password) {
          return true;
        }
        return false;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 3900;
      case ModelType.GPT3p5Turbo:
        return 3900;
      case ModelType.GPT4TurboPreview:
        return 3900;
      case ModelType.Claude3Opus20240229:
        return 3900;
      case ModelType.MistralLarge:
        return 3900;
      case ModelType.Claude3Sonnet20240229:
        return 3900;
      case ModelType.Sonar:
        return 3900;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    req.messages = req.messages.filter((v) => v.role !== 'system');
    const reqH = await super.preHandle(req, {
      token: false,
      countPrompt: true,
      forceRemove: true,
    });
    if (req.model.indexOf('claude') > -1) {
      reqH.prompt =
        reqH.messages
          .map(
            (v) =>
              `${v.role === 'assistant' ? 'Assistant' : 'Human'}: ${v.content}`,
          )
          .join('\n') + '\nAssistant: ';
    } else {
      reqH.prompt =
        reqH.messages.map((v) => `${v.role}_role: ${v.content}`).join('\n') +
        '\nassistant_role: ';
    }
    if (Config.config.perauto?.system) {
      reqH.prompt =
        Config.config.perauto?.system.replace(/\%s/g, req.model) + reqH.prompt;
    }
    return reqH;
  }

  public async askStream(req: PerplexityChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'please retry later!' });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    let old = '';
    try {
      const end = await child.sendMsg(
        req.model.indexOf('net') > -1 ? FocusType.All : FocusType.Writing,
        req.prompt,
        async (ansType, ansObj) => {
          this.logger.debug(`recv msg ${ansType} ${ansObj}`);
          if (ansObj.query_str) {
            return;
          }
          try {
            switch (ansType) {
              case 'completed':
                child.update({ failedCnt: 0 });
                if (ansObj.answer.length > old.length) {
                  const newContent = ansObj.answer.substring(old.length);
                  for (let i = 0; i < newContent.length; i += 3) {
                    stream.write(Event.message, {
                      content: newContent.slice(i, i + 3),
                    });
                  }
                }
                stream.write(Event.done, { content: '' });
                stream.end();
                await end();
                child.release();
                this.logger.info('Recv msg ok');
                break;
              case 'query_progress':
                if (!old && ansObj.answer?.startsWith(':')) {
                  ansObj.answer = ansObj.answer.slice(1);
                }
                if (
                  ansObj.answer.length === 0 &&
                  (req.model === ModelType.NetGPT4 ||
                    req.model === ModelType.NetGpt3p5)
                ) {
                  stream.write(Event.message, {
                    content:
                      ansObj.web_results
                        .map((v) => `- [${v.name}](${v.url})`)
                        .join('\n') + '\n\n',
                  });
                }
                if (ansObj.answer.length > old.length) {
                  const newContent = ansObj.answer.substring(old.length);
                  for (let i = 0; i < newContent.length; i += 3) {
                    stream.write(Event.message, {
                      content: newContent.slice(i, i + 3),
                    });
                  }
                  old = ansObj.answer;
                }
            }
          } catch (e) {
            throw e;
          }
        },
        () => {
          stream.write(Event.error, { error: 'timeout' });
          stream.write(Event.done, { content: '' });
          stream.end();
          child.update({ failedCnt: child.info.failedCnt + 1 });
          if (child.info.failedCnt > 3) {
            child.destroy({ delFile: false, delMem: true });
          } else {
            child.release();
          }
        },
      );
    } catch (err: any) {
      child.update({ failedCnt: child.info.failedCnt + 1 });
      if (child.info.failedCnt > 5) {
        child.destroy({ delFile: false, delMem: true });
      } else {
        child.release();
      }
      throw new ComError(err.message, ComError.Status.BadRequest);
    }
  }
}
