import { ComChild, DestroyOptions } from '../../utils/pool';
import { Account, MessageReq, MessageRes, PerLabEvents } from './define';
import {
  CreateNewPage,
  CreateSocketIO,
  getProxy,
} from '../../utils/proxyAgent';
import { Socket } from 'socket.io-client';
import { Event, EventStream, preOrderUserAssistant, sleep } from '../../utils';
import { contentToString, Message, ModelType } from '../base';
import { fuckCF } from '../../utils/captcha';

export class Child extends ComChild<Account> {
  client!: Socket;
  proxy: string = this.info.proxy || getProxy();

  async init(): Promise<void> {
    let { page, release } = await CreateNewPage('https://labs.perplexity.ai', {
      proxy: this.proxy,
      recognize: false,
      enable_user_cache: true,
    });
    page = await fuckCF(page);
    const cookies = await page.cookies();
    const useragent = await page.evaluate(() => window.navigator.userAgent);
    release();
    this.client = CreateSocketIO('wss://www.perplexity.ai', {
      proxy: this.proxy,
      extraHeaders: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Cookie: cookies.map((v) => `${v.name}=${v.value}`).join('; '),
        'User-Agent': useragent,
        Origin: 'https://labs.perplexity.ai',
        'Sec-WebSocket-Version': '13',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
        'Sec-WebSocket-Extensions':
          'permessage-deflate; client_max_window_bits',
      },
    });

    await new Promise<void>((resolve, reject) => {
      this.client.on('connect', () => {
        this.logger.info('connect');
        resolve();
      });
      this.client.on('connect_error', (err) => {
        reject(err);
      });
    });
    this.client.on('disconnect', (reason, description) => {
      this.logger.error(`disconnect: ${reason} ${JSON.stringify(description)}`);
      this.destroy({ delFile: true, delMem: true });
    });
    this.update({ proxy: this.proxy });
  }

  initFailed(e?: Error) {
    this.destroy({ delFile: true, delMem: true });
  }

  async destroy(options?: DestroyOptions) {
    super.destroy(options);
    await sleep(2 * 60 * 1000);
    if (this.client) {
      this.client.disconnect();
    }
  }

  async askForStream(
    model: ModelType,
    messages: Message[],
    stream: EventStream,
  ) {
    const msg: MessageReq = {
      version: '2.9',
      source: 'default',
      model,
      messages: preOrderUserAssistant(
        messages.map((v) => ({
          ...v,
          role: v.role === 'assistant' ? 'assistant' : 'user',
        })),
      ).map((v) => {
        return {
          content: contentToString(v.content),
          role: v.role,
          priority: 0,
        };
      }),
      timezone: 'Asia/Shanghai',
    };
    let old = '';
    const delay = setTimeout(() => {
      this.logger.warn(`timeout, msg: ${JSON.stringify({ model, messages })}`);
      stream.write(Event.error, { error: 'timeout' });
      stream.write(Event.done, { content: '' });
      stream.end();
      this.destroy({ delFile: false, delMem: true });
    }, 5000);
    const event = `${model}_${PerLabEvents.QueryProgress}`;
    this.client.on(event, (data: MessageRes) => {
      if (!data.output) {
        this.logger.warn(
          `no output! ${JSON.stringify({ data, model, messages })}`,
        );
        return;
      }
      delay.refresh();
      stream.write(Event.message, {
        content: data.output.substring(old.length),
      });
      old = data.output;
      if (data.final) {
        this.logger.info('Recv msg ok');
        stream.write(Event.done, { content: '' });
        stream.end();
        this.client.removeListener(event);
        this.release();
        clearTimeout(delay);
        return;
      }
    });
    this.client.emit(PerLabEvents.PerplexityLabs, msg);
  }
}
