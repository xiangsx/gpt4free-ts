import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { EventStream } from '../../utils';
import { Pool } from '../../utils/pool';
import { Account } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import moment from 'moment';
import { v4 } from 'uuid';

interface RealReq {
  model: string;
  prompt: string;
  max_tokens_to_sample: number;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  metadata?: object;
  stream?: boolean;
}

export class ClaudeAuto extends Chat {
  pool = new Pool<Account, Child>(
    this.options?.name || 'claude-api',
    () => Config.config.claudeauto?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.apikey) {
        return false;
      }
      if (v.banned) {
        return false;
      }
      if (v.low_credit) {
        return false;
      }
      if (v.refresh_unix && moment().unix() < v.refresh_unix) {
        return false;
      }
      return true;
    },
    {
      delay: 3000,
      serial: () => Config.config.claudeauto?.serial || 1,
      needDel: (info) => !info.apikey || !!info.banned || !!info.low_credit,
      preHandleAllInfos: async (allInfos) => {
        const oldSet = new Set(allInfos.map((v) => v.apikey));
        for (const v of Config.config.claudeauto?.apikey_list || []) {
          if (!oldSet.has(v)) {
            allInfos.push({
              id: v4(),
              apikey: v,
            } as Account);
          }
        }
        return allInfos;
      },
    },
  );
  protected options?: ChatOptions;

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Claude3Opus20240229:
        return 150 * 1000;
      case ModelType.Claude3Sonnet20240229:
        return 150 * 1000;
      default:
        return 0;
    }
  }

  async preHandle(
    req: ChatRequest,
    options?: {
      token?: boolean;
      countPrompt?: boolean;
      forceRemove?: boolean;
      stream?: EventStream;
    },
  ): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: false,
    });
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    await child.askMessagesStream(req, stream);
  }
}
