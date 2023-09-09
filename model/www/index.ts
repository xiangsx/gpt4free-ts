import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
} from '../base';
import { Event, EventStream, getTokenSize, sleep } from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewBrowser } from '../../utils/proxyAgent';
import { Browser } from 'puppeteer';
import { simplifyPageAll } from '../../utils/puppeteer';

puppeteer.use(StealthPlugin());

interface WWWChatRequest extends ChatRequest {
  max_tokens?: number;
}

export class WWW extends Chat {
  private browser?: Browser;
  constructor(options?: ChatOptions) {
    super(options);
  }

  async init() {
    this.browser = await CreateNewBrowser();
  }

  async newPage() {
    if (!this.browser) throw new Error('browser not init');
    const page = await this.browser.newPage();
    await simplifyPageAll(page);
    return page;
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
    if (!this.browser) {
      await this.init();
      this.logger.info('init ok');
    }
    const page = await this.newPage();
    try {
      await page
        .goto(req.prompt, {
          waitUntil: 'domcontentloaded',
          timeout: 5000,
        })
        .catch((err) => this.logger.error(`page load failed, `, err));

      // @ts-ignore
      let content = await page.$$eval(
        'p, h1, h2, h3, h4, h5, h6, div, section, article, main',
        (elements) => {
          let textEntries = [];
          const textMap = new Map();

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
      const maxToken = +(req.max_tokens || process.env.WWW_MAX_TOKEN || 2000);
      const token = getTokenSize(content);
      if (token > maxToken) {
        content = content.slice(
          0,
          Math.floor((content.length * maxToken) / token),
        );
      }
      stream.write(Event.message, { content });
    } catch (e: any) {
      this.logger.error('ask stream failed', e);
      stream.write(Event.error, { error: e.message });
    } finally {
      stream.write(Event.done, { content: '' });
      stream.end();
      await page.close();
    }
  }
}
