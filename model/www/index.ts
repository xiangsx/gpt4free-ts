import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, getTokenCount } from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewBrowser, CreateNewPage } from '../../utils/proxyAgent';
import { Page } from 'puppeteer';
import { simplifyPageAll } from '../../utils/puppeteer';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import moment from 'moment';
import { Config } from '../../utils/config';

puppeteer.use(StealthPlugin());

interface WWWChatRequest extends ChatRequest {
  max_tokens?: number;
}

interface Account extends ComInfo {}

class Child extends ComChild<Account> {
  public page!: Page;

  constructor(label: string, info: any, options?: ChildOptions) {
    super(label, info, options);
  }

  async init(): Promise<void> {
    this.page = await CreateNewPage('about:blank', {
      simplify: true,
      recognize: true,
      protocolTimeout: 5000,
    });
  }

  async getURLInfo(url: string): Promise<string> {
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
      let content = await this.page.$$eval(
        'p, h1, h2, h3, h4, h5, h6, div, section, article, main',
        // @ts-ignore
        (elements) => {
          let textEntries = [];
          const textMap = new Map();

          // @ts-ignore
          elements.forEach((element) => {
            const tag = element.tagName.toLowerCase();
            const newText = element.innerText;
            const position = element.offsetTop; // 获取元素在页面上的垂直位置

            let shouldAdd = true;

            Array.from(textMap.keys()).forEach((storedText) => {
              if (newText.includes(storedText)) {
                if (newText.length > storedText.length) {
                  textMap.delete(storedText);
                } else {
                  shouldAdd = false;
                }
              } else if (storedText.includes(newText)) {
                shouldAdd = false;
              }
            });

            if (shouldAdd) {
              textMap.set(newText, { tag, position });
            }
          });

          // Convert the map to an array of entries (text, tag, and position)
          textEntries = Array.from(textMap.entries());

          // Sort by position (from top to bottom)
          textEntries = textEntries.sort(
            (a, b) => a[1].position - b[1].position,
          );

          // Create the final text
          const maxText = textEntries.map((entry) => entry[0]).join('\n');

          // Post-processing to remove extra whitespace and newlines
          return maxText.replace(/\s+/g, ' ').trim();
        },
      );
      return content;
    } catch (e: any) {
      this.logger.error(e.message);
      return 'None';
    }
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    this.page?.browser().close();
    super.destroy(options);
  }
}

export class WWW extends Chat {
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.www.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      return false;
    },
    { delay: 1000, serial: () => Config.config.www.serial || 1 },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.URL:
        return 2000;
      default:
        return 0;
    }
  }

  async askStream(req: WWWChatRequest, stream: EventStream): Promise<void> {
    const child = await this.pool.pop();
    try {
      let content = await child.getURLInfo(req.prompt);
      const maxToken = +(req.max_tokens || process.env.WWW_MAX_TOKEN || 2000);
      const token = getTokenCount(content);
      if (token > maxToken) {
        content = content.slice(
          0,
          Math.floor((content.length * maxToken) / token),
        );
      }
      stream.write(Event.message, { content });
    } catch {
      stream.write(Event.message, { content: '' });
    } finally {
      stream.write(Event.done, { content: '' });
      stream.end();
      child.release();
    }
  }
}
