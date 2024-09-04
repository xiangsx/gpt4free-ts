import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  checkSensitiveWords,
  Event,
  EventStream,
  parseJSON,
} from '../../utils';
import { Pool } from '../../utils/pool';
import { Account } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import moment from 'moment';
import { v4 } from 'uuid';
import es from 'event-stream';
import { clearTimeout } from 'node:timers';

interface RealReq {
  model: string;
  prompt: string;
  max_tokens_to_sample: number;
  stop_sequences?: string[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  metadata?: object;
  stream?: boolean;
}

export class ClaudeAuto extends Chat {
  pool = new Pool<Account, Child>(
    this.options?.name || 'claude-api',
    () => Config.config.claudeauto?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.apikey) {
        return false;
      }
      if (v.banned) {
        return false;
      }
      if (v.low_credit) {
        return false;
      }
      if (v.refresh_unix && moment().unix() < v.refresh_unix) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.claudeauto?.serial || 1,
      needDel: (info) => !info.apikey || !!info.banned || !!info.low_credit,
      preHandleAllInfos: async (allInfos) => {
        const oldSet = new Set(allInfos.map((v) => v.apikey));
        for (const v of Config.config.claudeauto?.apikey_list || []) {
          if (!oldSet.has(v)) {
            allInfos.push({
              id: v4(),
              apikey: v,
            } as Account);
          }
        }
        return allInfos;
      },
    },
  );
  protected options?: ChatOptions;

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Claude3Opus20240229:
        return 150 * 1000;
      case ModelType.Claude3Sonnet20240229:
        return 150 * 1000;
      case ModelType.Claude3Haiku20240307:
        return 150 * 1000;
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
      token: true,
      countPrompt: false,
      forceRemove: false,
    });
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();

    try {
      if (checkSensitiveWords(req.prompt)) {
        throw new Error('Sensitive words detected');
      }
      const pt = await child.askMessagesStream(req);
      this.logger.info('recv res oik');
      pt.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          this.logger.debug(chunk);
          let dataStr;
          if (chunk.indexOf('event: ') > -1) {
            dataStr = chunk.split('\n')[1]?.replace('data: ', '');
          } else {
            dataStr = chunk.replace('data: ', '');
          }
          if (!dataStr) {
            return;
          }
          const data = parseJSON<{
            content_block: { text: string };
            delta: { text: string };
            error: { type: string; message: 'string' };
            type:
              | 'error'
              | 'message_stop'
              | 'message_delta'
              | 'content_block_stop'
              | 'content_block_start';
          }>(dataStr, {} as any);
          if (data.error) {
            this.logger.error(`Recv error: ${data.error.message}`);
            stream.write(Event.error, { error: data.error.message });
            stream.end();
            return;
          }
          if (data.delta && data.delta.text) {
            stream.write(Event.message, { content: data.delta.text });
            return;
          }
          if (data.content_block && data.content_block.text) {
            stream.write(Event.message, { content: data.content_block.text });
            return;
          }
        }),
      );
      pt.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        this.logger.info('Recv ok');
      });
    } catch (e: any) {
      this.logger.error(`claude messages failed: ${e.message}`);
      if (e.response) {
        e.response.data?.on?.('data', (v: any) => {
          const msg = v.toString();
          this.logger.error(
            `${child.info.apikey} ${e.response.status} ${v.toString()}`,
          );
          if (msg.indexOf('Your credit balance is too low') > -1) {
            child.update({ low_credit: true });
            child.destroy({ delFile: true, delMem: true });
          }
          if (msg.indexOf('This organization has been disabled') > -1) {
            child.update({ banned: true });
            child.destroy({ delFile: true, delMem: true });
          }
        });
      }
      stream.write(Event.error, { error: e.message, status: e.status });
      stream.end();
      if (e.response && e.response.status === 401) {
        child.update({ banned: true });
        child.destroy({ delFile: true, delMem: true });
      }
      if (e.response && e.response.status === 429) {
        child.destroy({ delFile: false, delMem: true });
        child.update({ refresh_unix: moment().unix() + 30 });
      }
    }
  }
}
