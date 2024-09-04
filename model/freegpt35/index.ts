import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { EventStream } from '../../utils';
import { Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import { Account } from './define';
import { Child } from './child';

export class FreeGPT35 extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.freegpt35?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.freegpt35?.serial || 1,
      needDel: () => true,
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 5000;
      case ModelType.GPT3p5_16k:
        return 5000;
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
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    await child.askForStream(req, stream);
  }
}
