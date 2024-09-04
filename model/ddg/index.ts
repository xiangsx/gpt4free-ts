import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  ComError,
  Event,
  EventStream,
  parseJSON,
  randomUserAgent,
} from '../../utils';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CreateNewAxios, CreateNewPage } from '../../utils/proxyAgent';
import { Page } from 'puppeteer';
import {
  ChildOptions,
  ComChild,
  ComInfo,
  DestroyOptions,
  Pool,
} from '../../utils/pool';
import { Config } from '../../utils/config';
import es from 'event-stream';
import { ModelMap } from './define';

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
        cookies: [
          { name: 'l', value: 'cn-zh', domain: 'duckduckgo.com' },
          { name: 'ah', value: 'cn-zh%2Cau-en', domain: 'duckduckgo.com' },
        ],
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
      case ModelType.Claude3Haiku20240307:
        return 150 * 1000;
      case ModelType.GPT3p5Turbo0125:
        return 150 * 1000;
      case ModelType.LLama_3_70b_chat:
        return 10000;
      case ModelType.Mixtral8x7bInstruct:
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

  async searchStream(req: ChatRequest, stream: EventStream) {
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

  async chatStream(req: ChatRequest, stream: EventStream): Promise<void> {
    try {
      const useragent = randomUserAgent();
      const client = CreateNewAxios(
        {
          baseURL: 'https://duckduckgo.com',
          headers: { 'User-Agent': useragent },
        },
        { proxy: true },
      );
      const statusRes = await client.get('/duckchat/v1/status', {
        headers: {
          'x-vqd-accept': '1',
          'cache-control': 'no-store',
        },
      });
      const res = await client.post(
        '/duckchat/v1/chat',
        {
          model: ModelMap[req.model] || req.model,
          messages: req.messages,
        },
        {
          responseType: 'stream',
          headers: {
            'x-vqd-4': statusRes.headers['x-vqd-4'],
          },
        },
      );
      const pt = res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const res = chunk.toString();
          if (!res) {
            return;
          }
          const dataStr = res.replace('data: ', '');
          const data = parseJSON<undefined | { role: string; message: string }>(
            dataStr,
            undefined,
          );
          if (dataStr === '[DONE]') {
            pt.end();
            pt.destroy();
            return;
          }
          cb(null, data);
        }),
      );
      pt.on('data', (data: any) => {
        stream.write(Event.message, { content: data.message });
      });
      pt.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      throw new ComError(e.message, ComError.Status.InternalServerError);
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    switch (req.model) {
      case ModelType.Search:
        return this.searchStream(req, stream);
      default:
        return this.chatStream(req, stream);
    }
  }
}
