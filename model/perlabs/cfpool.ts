import { Page } from 'puppeteer';
import { CreateNewPage, getProxy } from '../../utils/proxyAgent';
import { v4 } from 'uuid';
import { fuckCF } from '../../utils/captcha';
import { getRandomOne } from '../../utils';
import { Config } from '../../utils/config';

export class PagePool {
  private idle: Map<string, PageChild> = new Map();
  private using: Map<string, PageChild> = new Map();

  async pop(): Promise<PageChild> {
    if (this.idle.size === 0) {
      const child = new PageChild(v4(), 'https://labs.perplexity.ai');
      const ok = await child.init();
      if (!ok) {
        throw new Error('page pool has no child and cannot init');
      }
      return child;
    }
    const [id, page] = this.idle.entries().next().value;
    this.idle.delete(id);
    this.using.set(id, page);
    return page;
  }

  async release(child: PageChild) {
    await child.release();
    this.using.delete(child.id);
    this.idle.set(child.id, child);
  }

  async destroy(child: PageChild) {
    if (!child) {
      return;
    }
    await child?.destroy?.();
    this.using.delete(child.id);
    this.idle.delete(child.id);
  }
}

export class PageChild {
  public page!: Page;
  private releasePage: any;
  public proxy = getProxy();
  constructor(public id: string, private url: string) {}
  async init(): Promise<boolean> {
    try {
      let { page, release } = await CreateNewPage(this.url, {
        enable_user_cache: true,
        recognize: false,
        proxy: this.proxy,
      });
      page = await fuckCF(page);
      this.releasePage = release;
      this.page = page;
      return true;
    } catch (e: any) {
      console.error(`PageChild.init failed, err: ${e.message}`);
      this.page?.browser?.().close?.();
      return false;
    }
  }
  async release() {
    const cookies = await this.page.cookies(this.url);
    await this.page.deleteCookie(
      ...cookies.filter((v) => v.name.indexOf('cf') === -1),
    );
  }

  async destroy() {
    this.releasePage();
  }
}
