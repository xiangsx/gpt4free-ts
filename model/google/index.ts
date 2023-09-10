import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, sleep } from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewBrowser } from '../../utils/proxyAgent';
import { Browser } from 'puppeteer';
import { simplifyPageAll } from '../../utils/puppeteer';

puppeteer.use(StealthPlugin());

export class Google extends Chat {
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
        `https://www.google.com.hk/search?q=${req.prompt}+&hl=zh-CN`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForSelector('.g');

      // 提取搜索结果的标题和链接
      const results = await page.evaluate(() => {
        const nodes = document.querySelectorAll('.g');
        // @ts-ignore
        const extractedResults = [];

        nodes.forEach((node) => {
          const titleNode = node.querySelector('h3');
          const linkNode = node.querySelector('.yuRUbf a');
          const descriptionNode = node.querySelector('.VwiC3b');

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
      await page.screenshot({ path: `./run/google.png` });
      await this.browser?.close();
      await this.init();
    } finally {
      stream.write(Event.done, { content: '' });
      stream.end();
      await page.close();
    }
  }
}
