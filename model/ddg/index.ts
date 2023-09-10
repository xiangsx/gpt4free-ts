import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { Event, EventStream, sleep } from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewBrowser } from '../../utils/proxyAgent';
import { Browser } from 'puppeteer';
import { simplifyPageAll } from '../../utils/puppeteer';

puppeteer.use(StealthPlugin());

export class DDG extends Chat {
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
        `https://duckduckgo.com/?kad=zh_CN&kk=-1&k1=-1&kau=-1&kao=-1&kap=-1&kaq=-1&kax=-1&kak=-1&kv=-1&kp=1&kah=cn-zh&kl=cn-zh&q=${req.prompt}`,
        {
          waitUntil: 'domcontentloaded',
        },
      );
      await page.waitForSelector('li[data-layout="organic"]');
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
