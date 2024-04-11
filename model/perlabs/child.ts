import { ComChild, DestroyOptions } from '../../utils/pool';
import { Account, MessageReq, MessageRes, PerLabEvents } from './define';
import { CreateSocketIO } from '../../utils/proxyAgent';
import { Socket } from 'socket.io-client';
import { Event, EventStream, sleep } from '../../utils';
import { Message, ModelType } from '../base';

export class Child extends ComChild<Account> {
  client!: Socket;

  async init(): Promise<void> {
    this.client = CreateSocketIO('wss://labs-api.perplexity.ai', {
      proxy: true,
      extraHeaders: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        Origin: 'https://labs.perplexity.ai',
        'Sec-WebSocket-Version': '13',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,en-GB;q=0.6',
        'Sec-WebSocket-Key': 'ZT7/mH3h607VU5MyIYIzdQ==',
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
      this.logger.error(`disconnect: ${reason} ${description}`);
      this.destroy({ delFile: true, delMem: true });
    });
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
      version: '2.5',
      source: 'default',
      model,
      messages: messages.map((v) => {
        return {
          ...v,
          priority: 0,
        };
      }),
      timezone: 'Asia/Shanghai',
    };
    let old = '';
    this.client.onAny((event, data: MessageRes) => {
      if (event.indexOf(PerLabEvents.QueryProgress) === -1) {
        return;
      }
      stream.write(Event.message, {
        content: data.output.substring(old.length),
      });
      if (data.final) {
        stream.write(Event.done, { content: '' });
        stream.end();
        this.release();
        return;
      }
    });
    this.client.emit(PerLabEvents.PerplexityLabs, msg);
  }
}
