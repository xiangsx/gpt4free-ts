import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import { Account, PerLabsModelExistedMap } from './define';
import { Child } from './child';
import { EventStream } from '../../utils';

export class PerLabs extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.perlabs?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.proxy) {
        return false;
      }
      return true;
    },
    {
      delay: 200,
      serial: () => Config.config.perlabs?.serial || 1,
      needDel: (info) => {
        return !info.proxy;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    if (PerLabsModelExistedMap[model]) {
      return Number.MAX_SAFE_INTEGER;
    }
    return 0;
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    await child.askForStream(req.model, req.messages, stream);
  }
}
