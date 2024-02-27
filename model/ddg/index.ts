import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream } from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewPage } from '../../utils/proxyAgent';
import { Page } from 'puppeteer';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import moment from 'moment/moment';
import { Config } from '../../utils/config';

puppeteer.use(StealthPlugin());
interface Account extends ComInfo {}

class Child extends ComChild<Account> {
  public page!: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  async init(): Promise<void> {
    this.page = await CreateNewPage(
      'https://duckduckgo.com/?kk=-1&k1=-1&kau=-1&kao=-1&kap=-1&kaq=-1&kax=-1&kak=-1&kv=-1&kp=1',
      {
        simplify: true,
        recognize: true,
        protocolTimeout: 5000,
      },
    );
  }

  async search(query: string) {
    const page = this.page;
    try {
      await page.goto(
        `https://duckduckgo.com/?kk=-1&k1=-1&kau=-1&kao=-1&kap=-1&kaq=-1&kax=-1&kak=-1&kv=-1&kp=1&q=${query.slice(
          0,
          150,
        )}`,
        {
          waitUntil: 'domcontentloaded',
        },
      );
      await page.waitForSelector('li[data-layout="organic"]', {
        timeout: 5 * 1000,
      });

      // 提取搜索结果的标题和链接
      const results = await page.evaluate(() => {
        const nodes = document.querySelectorAll('li[data-layout="organic"]');
        // @ts-ignore
        const extractedResults = [];

        nodes.forEach((node) => {
          const titleNode = node.querySelector('h2');
          const linkNode = node.querySelector(
            'a[data-testid="result-title-a"]',
          );
          const descriptionNode = node.querySelector(
            'div[data-result="snippet"]',
          );

          const title = titleNode ? titleNode.innerText : 'N/A';
          const link = linkNode ? linkNode.getAttribute('href') : 'N/A';
          const favicon =
            'https:' + node.querySelector('img')?.getAttribute('src');
          const description = descriptionNode
            ? // @ts-ignore
              descriptionNode.innerText
            : 'N/A';

          extractedResults.push({ title, link, description, favicon });
        });

        // @ts-ignore
        return extractedResults;
      });
      this.release();
      return results;
    } catch (e: any) {
      this.logger.error(e.message);
      this.destroy({ delFile: true, delMem: true });
      this.release();
      return [];
    }
  }

  initFailed() {
    this.page?.browser().close().catch(this.logger.error);
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    this.page?.browser().close().catch(this.logger.error);
    super.destroy(options);
  }
}

export class DDG extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.ddg.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return false;
    },
    { delay: 1000, serial: () => Config.config.ddg.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Search:
        return 10000;
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
      token: false,
      countPrompt: true,
      forceRemove: true,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    try {
      const child = await this.pool.pop();
      const result = await child.search(req.prompt);
      stream.write(Event.message, { content: JSON.stringify(result) });
    } catch (e) {
      stream.write(Event.message, { content: '[]' });
    } finally {
      stream.write(Event.done, { content: '' });
      stream.end();
    }
  }
}
