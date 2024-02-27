import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, sleep } from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewBrowser } from '../../utils/proxyAgent';
import { Browser } from 'puppeteer';
import { simplifyPageAll } from '../../utils/puppeteer';

puppeteer.use(StealthPlugin());

export class Bing extends Chat {
  private browser?: Browser;
  constructor(options?: ChatOptions) {
    super(options);
  }

  async init() {
    this.browser = await CreateNewBrowser();
    this.logger.info('init ok');
  }

  async newPage() {
    if (!this.browser) throw new Error('browser not init');
    const page = await this.browser.newPage();
    await simplifyPageAll(page);
    return page;
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Search:
        return 2000;
      default:
        return 0;
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    if (!this.browser) {
      await this.init();
    }
    const page = await this.newPage();
    try {
      await page.goto(
        `https://www.bing.com/search?q=${req.prompt}&form=QBLH&sp=-1&lq=0&pq=${req.prompt}&sc=1-9&qs=n&sk=&&ghsh=0&ghacc=0&ghpl=`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForSelector('.b_algo');

      // 提取搜索结果的标题和链接
      const results = await page.evaluate(() => {
        const nodes = document.querySelectorAll('.b_algo');
        // @ts-ignore
        const extractedResults = [];

        nodes.forEach((node) => {
          const titleNode = node.querySelector('h2 a');
          const linkNode = node.querySelector('.b_title h2 a');
          const descriptionNode = node.querySelector('.b_caption p');

          if (!titleNode || !linkNode || !descriptionNode) return;
          // @ts-ignore
          const title = titleNode ? titleNode.innerText : 'N/A';
          const link = linkNode ? linkNode.getAttribute('href') : 'N/A';
          const description = descriptionNode
            ? // @ts-ignore
              descriptionNode.innerText
            : 'N/A';

          extractedResults.push({ title, link, description });
        });

        // @ts-ignore
        return extractedResults;
      });

      stream.write(Event.message, { content: JSON.stringify(results) });
    } catch (e: any) {
      this.logger.error('ask stream failed', e);
      stream.write(Event.error, { error: e.message });
      await this.browser?.close();
      await this.init();
    } finally {
      stream.write(Event.done, { content: '' });
      stream.end();
      await page.close();
    }
  }
}
