import { Chat, ChatOptions, ChatRequest, ModelType, Site } from '../base';
import { Pool } from '../../utils/pool';
import { Account, getFireworksModel } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import { EventStream } from '../../utils';
import moment from 'moment';

export class Fireworks extends Chat {
  constructor(options?: ChatOptions) {
    super(options);
  }

  private pool: Pool<Account, Child> = new Pool<Account, Child>(
    this.options?.name || 'fireworks',
    () => Config.config.fireworks?.size || 0,
    (info, options) =>
      new Child(this.options?.name || 'fireworks', info, options),
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
          Config.config.fireworks?.accounts.map((v) => v.email) || [],
        );
        for (const v of allInfos) {
          oldInfoMap[v.email] = v;
          if (!newInfoSet.has(v.email)) {
            newInfos.push(v);
          }
        }
        for (const v of Config.config.fireworks?.accounts || []) {
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
      serial: Config.config.fireworks?.serial || 1,
      needDel: (info) => {
        if (!info.email || !info.password) {
          return true;
        }
        return false;
      },
    },
  );

  support(model: ModelType): number {
    const v = getFireworksModel(model);
    if (v) {
      return v.context_window;
    }
    return 0;
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    const model = getFireworksModel(req.model);
    const request = {
      model: model.id,
      max_tokens: model.max_tokens,
      top_p: 1,
      top_k: 40,
      presence_penalty: 0,
      frequency_penalty: 0,
      temperature: req.temperature || 1,
      messages: req.messages,
      stream: true,
      n: 1,
      logprobs: 1,
    };
    await child.askForStream(request, stream);
  }
}
