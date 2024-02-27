import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Pool } from '../../utils/pool';
import { Account, Message } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import { Event, EventStream, parseJSON } from '../../utils';
import { WSS } from '../../utils/proxyAgent';

export class BingCopilot extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.bingcopilot.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    () => true,
    {
      serial: Config.config.bingcopilot.serial,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Bing:
        return 2000;
      default:
        return 0;
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    const c = await child.createConversation();
    const wss = new WSS(
      `wss://sydney.bing.com/sydney/ChatHub?sec_access_token=${c.sign}`,
      {
        onOpen: () => {
          this.logger.info('open');
          wss.send(`{"protocol":"json","version":1}`);
        },
        onMessage: async (v) => {
          this.logger.info(v);
          const data = parseJSON<Message | undefined>(
            v.slice(0, v.length - 1),
            undefined,
          );
          if (!data) {
            return;
          }
          if (!data.type) {
            wss.send(`{"type":6}`);
            wss.send(
              await child.createMessage(
                c.data.conversationId,
                c.data.clientId,
                req.prompt,
              ),
            );
          }

          switch (data.type) {
            case 1:
              for (const v of data.arguments) {
                for (const m of v.messages) {
                  stream.write(Event.message, { content: m.text });
                }
              }
              break;
            case 2:
              stream.write(Event.done, { content: '' });
              stream.end();
              break;
            default:
              break;
          }
        },
        onClose: () => {},
        onError: (e: any) => {
          console.error(e);
        },
      },
    );
  }
}
