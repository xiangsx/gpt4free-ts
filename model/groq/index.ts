import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import { Account, GroqModelsMap } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import { EventStream } from '../../utils';
import moment from 'moment';

export class Groq extends Chat {
  constructor(options?: ChatOptions) {
    super(options);
  }

  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'groq',
    () => Config.config.groq?.size || 0,
    (info, options) => new Child(this.options?.name || 'groq', info, options),
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
          Config.config.groq?.accounts.map((v) => v.email) || [],
        );
        for (const v of allInfos) {
          oldInfoMap[v.email] = v;
          if (!newInfoSet.has(v.email)) {
            newInfos.push(v);
          }
        }
        for (const v of Config.config.groq?.accounts || []) {
          let old = oldInfoMap[v.email];
          if (!old) {
            old = {
              id: v4(),
              email: v.email,
              password: v.password,
              recovery: v.recovery,
            } as Account;
            newInfos.push(old);
            continue;
          }
          old.password = v.password;
          newInfos.push(old);
        }
        return newInfos;
      },
      delay: 1000,
      serial: Config.config.groq?.serial || 1,
      needDel: (info) => {
        if (!info.email || !info.password) {
          return true;
        }
        return false;
      },
    },
  );

  support(model: ModelType): number {
    const v = GroqModelsMap[model];
    if (v) {
      return v.context_window;
    }
    return 0;
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    const request = {
      model: req.model,
      messages: req.messages,
      temperature: 0.2,
      max_tokens: 2048,
      top_p: 1,
      stream: true,
    };
    await child.askForStream(request, stream);
  }
}
