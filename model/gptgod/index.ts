import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, getRandomOne } from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateNewPage } from '../../utils/proxyAgent';
import moment from 'moment/moment';
import { Page } from 'puppeteer';

interface Account extends ComInfo {}

class Child extends ComChild<Account> {
  public page?: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  async init(): Promise<void> {
    const page = await CreateNewPage(
      getRandomOne([
        'https://gptgod.online',
        'https://gptgod.fun',
        'https://gptgod.work',
        'https://gptgod.site',
      ]),
      {
        fingerprint_inject: true,
      },
    );
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
  }

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
}

export class GPTGOD extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.airoom.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return false;
    },
    { delay: 1000, serial: () => Config.config.gptgod.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    return 0;
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: false,
      countPrompt: true,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    stream.write(Event.message, { content: '' });
    stream.write(Event.done, { content: '' });
  }
}
