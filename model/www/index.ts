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
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { AwsLambda } from 'elastic-apm-node/types/aws-lambda';

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
    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 15 * 1000,
    });
    const pdf = await this.page.pdf();
    const pdfText = await pdfParse(pdf);
    return pdfText.text;
  }

  initFailed() {
    this.page?.browser().close();
    this.destroy({ delFile: true, delMem: true });
  }

  destroy(options?: DestroyOptions) {
    this.page?.browser().close().catch(this.logger.error);
    super.destroy(options);
  }

  async release() {
    await this.page.goto('about:blank', { waitUntil: 'domcontentloaded' });
    super.release();
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
      child.release();
    } catch (e: any) {
      this.logger.error(e.message);
      stream.write(Event.message, { content: '' });
      child.destroy({ delFile: true, delMem: true });
    }
    stream.write(Event.done, { content: '' });
    stream.end();
  }
}
