import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, parseJSON } from '../../utils';
import { Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import moment from 'moment/moment';
import { v4 } from 'uuid';
import es from 'event-stream';
import { Account, ModelMap } from './define';
import { Child } from './child';

export class Merlin extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.merlin?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.accessToken) {
        return false;
      }
      if (!v.left && !v.useOutTime) {
        return false;
      }
      if (v.login_failed && v.login_failed > 3) {
        return false;
      }
      if (v.left < 10 && moment().unix() - v.useOutTime < 24 * 60 * 60) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.merlin?.serial || 1,
      needDel: (v) => !v.email || !v.accessToken || !v.password,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5800;
      case ModelType.GPT3p5Turbo:
        return 2500;
      case ModelType.Claude3Opus20240229:
        return 20000;
      case ModelType.Claude3Opus:
        return 20000;
      case ModelType.Claude3Haiku:
        return 20000;
      case ModelType.Claude3Haiku200k:
        return 20000;
      case ModelType.Claude3Haiku20240307:
        return 20000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    const reqH = await super.preHandle(req, {
      token: true,
      countPrompt: true,
      forceRemove: true,
    });
    if (reqH.model.indexOf('claude') > -1) {
      const historyMsgs = req.messages.slice(0, req.messages.length - 1);
      const newMsg = req.messages[req.messages.length - 1];
      req.prompt = `<history>${req.messages.map((v) => {
        const role = v.role === 'assistant' ? 'Assistant' : 'Human';
        return `<${role}>${v.content}</${role}>`;
      })}</history>
      
${newMsg}
`;
    }
    return reqH;
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    if (!child) {
      stream.write(Event.error, { error: 'No valid connections', status: 429 });
      stream.write(Event.done, { content: '' });
      stream.end();
      return;
    }
    try {
      const res = await child.client.post(
        '/thread/unified?customJWT=true&version=1.1',
        {
          action: {
            message: {
              attachments: [],
              content: `<history></history>`,
              metadata: {
                context: '',
              },
              parentId: 'root',
              role: 'user',
            },
            type: 'NEW',
          },
          activeThreadSnippet: [],
          chatId: v4(),
          language: 'AUTO',
          metadata: null,
          mode: 'VANILLA_CHAT',
          model: ModelMap[req.model],
          personaConfig: {},
        },
        {
          headers: {
            Authorization: `Bearer ${child.info.accessToken}`,
          },
          responseType: 'stream',
        },
      );
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map((chunk: any) => {
          try {
            const data = chunk.toString().replace('event: message\ndata: ', '');
            if (!data) {
              return;
            }
            const v = parseJSON<{
              data: {
                content: string;
                eventType: string;
                usage?: { used: number; limit: number };
              };
            }>(data, {} as any);
            switch (v.data.eventType) {
              case 'CHUNK':
                stream.write(Event.message, { content: v.data.content });
                return;
              case 'SYSTEM':
                if (!v.data.usage) {
                  return;
                }
                child.update({
                  left: v.data.usage?.limit - v.data.usage?.used,
                });
                return;
              case 'DONE':
                return;
              default:
                return;
            }
          } catch (e: any) {
            this.logger.error(`parse data failed, ${e.message}`);
          }
        }),
      );
      res.data.on('close', () => {
        this.logger.info('Msg recv ok');
        stream.write(Event.done, { content: '' });
        stream.end();
        if (child.info.left < 10) {
          child.update({ useOutTime: moment().unix() });
          child.destroy({ delFile: false, delMem: true });
        }
      });
    } catch (e: any) {
      this.logger.error(`ask failed, ${e.message}`);
      child.update({
        left: child.info.left - 10,
        useOutTime: moment().unix(),
      });
      stream.write(Event.error, {
        error: 'Something error, please retry later',
        status: 500,
      });
      stream.write(Event.done, { content: '' });
      stream.end();
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
