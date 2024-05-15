import { ComChild, DestroyOptions } from '../../utils/pool';
import { Account, MessageReq, MessageRes, PerLabEvents } from './define';
import { CreateSocketIO, getProxy } from '../../utils/proxyAgent';
import { Socket } from 'socket.io-client';
import { Event, EventStream, sleep } from '../../utils';
import { contentToString, Message, ModelType } from '../base';

export class Child extends ComChild<Account> {
  client!: Socket;
  proxy: string = this.info.proxy || getProxy();

  async init(): Promise<void> {
    this.client = CreateSocketIO('wss://www.perplexity.ai', {
      proxy: this.proxy,
      extraHeaders: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        Origin: 'https://labs.perplexity.ai',
        'Sec-WebSocket-Version': '13',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
        'Sec-WebSocket-Key': 'Q86A6uxijFOUouPweggX+Q==',
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
      messages: messages.map((v) => {
        return {
          content: contentToString(v.content),
          role: v.role === 'assistant' ? 'assistant' : 'user',
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
    this.client.onAny((event, data: MessageRes) => {
      if (event.indexOf(PerLabEvents.QueryProgress) === -1) {
        this.logger.warn(`unknown event! ${event}:${JSON.stringify(data)}`);
        return;
      }
      if (!data.output) {
        this.logger.warn(`no output! ${event}:${JSON.stringify(data)}`);
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
        this.release();
        clearTimeout(delay);
        return;
      }
    });
    this.client.emit(PerLabEvents.PerplexityLabs, msg);
  }
}
