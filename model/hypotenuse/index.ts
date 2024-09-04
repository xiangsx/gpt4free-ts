import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  Event,
  EventStream,
  getRandomOne,
  randomStr,
  sleep,
} from '../../utils';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import { CreateNewAxios, CreateNewPage } from '../../utils/proxyAgent';
import { CreateEmail } from '../../utils/emailFactory';
import { Page } from 'puppeteer';

const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT4]: '9675b1e8f62811eda0d10242ac130004',
  [ModelType.GPT3p5Turbo]: 'e5aba828ebef11edb9980242ac130003',
};

interface Account extends ComInfo {
  email: string;
  password: string;
  session: string;
}

class Child extends ComChild<Account> {
  public page?: Page;
  client = CreateNewAxios({
    baseURL: 'https://app.hypotenuse.ai',
  });

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  async init(): Promise<void> {
    try {
      let page: Page;
      this.logger.info('register new account ...');
      page = await CreateNewPage(`https://app.hypotenuse.ai/home`, {
        simplify: false,
      });
      await page.waitForSelector('div > p > a');
      await page.click('div > p > a');
      const mail = CreateEmail(Config.config.hypotenuse.mail_type);
      await page.waitForSelector('#email');
      await page.click('#email');
      const email = await mail.getMailAddress();
      await page.type('#email', email);
      await page.waitForSelector('#password');
      await page.click('#password');
      const password = randomStr(getRandomOne([15, 20, 21, 22, 23, 24, 25]));
      await page.type('#password', password);
      await page.click("button[type='submit']");
      let verifyURL = '';
      for (const v of await mail.waitMails()) {
        verifyURL = v.content.match(/href="https:\/\/dev(.+?)"/)?.[1] || '';
        if (verifyURL) {
          verifyURL = 'https://dev' + verifyURL;
          break;
        }
      }
      if (!verifyURL) {
        throw new Error('verifyURL not found');
      }
      const newPage = await page.browser().newPage();
      await newPage.goto(verifyURL);
      await sleep(3000);
      await newPage.close();
      await page.bringToFront();
      await page.waitForSelector(
        '.dimmable > .MuiPaper-root.MuiPaper-elevation1',
      );
      await page.click('.dimmable > .MuiPaper-root.MuiPaper-elevation1');
      await this.saveSess();
      this.page = page;
    } catch (e) {
      throw e;
    }
  }

  async createThreads() {
    const { data } = await this.client.post(
      '/chat/thread',
      {},
      {
        headers: {
          Cookie: `session=${this.info.session}`,
        },
      },
    );
    return data as {
      id: string;
      organization_id: string;
      user_id: string;
      created_at: number;
      deleted: boolean;
      deleted_at: number | null;
      display_name: string | null;
    };
  }

  async sendMessage(threadID: string, prompt: string) {
    const { data } = await this.client.post(
      `/chat/threads/${threadID}/messages`,
      {
        content: 'hello',
      },
      {
        headers: {
          Cookie: `session=${this.info.session}`,
        },
      },
    );
    return data as {
      id: string;
      thread_id: string;
      user_id: string;
      content: string;
      is_generated: boolean;
      created_at: number;
      deleted: boolean;
      deleted_at: number | null;
      reply_to_id: string | null;
      has_error_response: boolean;
      intermediate_steps: any | null; // 如果有具体类型，可以替换 `any`
      message_type: string;
      metadata: Record<string, any>; // 如果有更具体的类型，可以进行替换
      is_file_indexed: boolean | null;
      summary: string | null;
      sender_info: {
        id: string;
        display_name: string;
      };
      feedback_type: string | null;
    };
  }

  async genRes(thrID: string, msgID: string, model: ModelType) {
    const { data } = await this.client.post(
      `/chat/threads/${thrID}/messages/${msgID}/generate-respons`,
      {
        is_enhanced_quality: model === ModelType.GPT4,
        is_real_time_web_data: false,
      },
      {
        headers: {
          Cookie: `session=${this.info.session}`,
        },
      },
    );
    return data as {
      id: string;
      thread_id: string;
      user_id: string;
      content: string;
      is_generated: boolean;
      created_at: number;
      deleted: boolean;
      deleted_at: number | null;
      reply_to_id: string | null;
      has_error_response: boolean;
      intermediate_steps: any[] | null; // 如果有具体类型，可以替换 `any`
      message_type: string;
      metadata: Record<string, any>; // 如果有更具体的类型，可以进行替换
      is_file_indexed: boolean | null;
      summary: string | null;
      sender_info: {
        id: string;
        display_name: string;
      };
      feedback_type: string | null;
    };
  }

  async saveSess() {
    const cookies = await this.page?.cookies();
    const session = cookies?.find((v) => v.name === 'session');
    if (!session) {
      throw new Error('session not found');
    }
    this.update({ session: session.value });
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    super.destroy(options);
    this.page?.browser()?.close();
  }
}

export class Hypotenuse extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.hypotenuse.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.session) {
        return false;
      }
      return true;
    },
    { delay: 1000, serial: () => Config.config.hypotenuse.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 5000;
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.GPT3p5_16k:
        return 12000;
      default:
        return 0;
    }
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    return super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    try {
      const { id: thrID } = await child.createThreads();
      const { id: msgID } = await child.sendMessage(thrID, req.prompt);
      const res = await child.genRes(thrID, msgID, req.model);
      stream.write(Event.message, { content: res.content });
      stream.write(Event.done, { content: '' });
      stream.end();
    } catch (e: any) {
      this.logger.error(e);
      stream.write(Event.error, e.message);
      stream.end();
      child.destroy({ delFile: false, delMem: true });
    }
  }
}
