import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import {
  checkSensitiveWords,
  Event,
  EventStream,
  parseJSON,
} from '../../utils';
import { Pool } from '../../utils/pool';
import { Account, OpenaiError, ParamsList } from './define';
import { Child } from './child';
import { Config } from '../../utils/config';
import moment from 'moment';
import { v4 } from 'uuid';
import es from 'event-stream';
import { clearTimeout } from 'node:timers';
import { AsyncStoreSN } from '../../asyncstore';
import { AxiosRequestConfig } from 'axios';

interface RealReq extends ChatRequest {
  functions?: {
    name: string;
    description?: string;
    parameters: object;
  };
  function_call?: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: {};
  user?: string;
}

export class OpenAIAuto extends Chat {
  pool = new Pool<Account, Child>(
    this.options?.name || 'claude-api',
    () => Config.config.openaiauto?.size || 0,
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
      serial: () => Config.config.openaiauto?.serial || 1,
      needDel: (info) => !info.apikey || !!info.banned || !!info.low_credit,
      preHandleAllInfos: async (allInfos) => {
        const oldSet = new Set(allInfos.map((v) => v.apikey));
        for (const v of Config.config.openaiauto?.apikey_list || []) {
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
    if (Config.config.openaiauto?.limit_token_map[model]) {
      return Config.config.openaiauto?.limit_token_map[model];
    }
    return 0;
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
    const data: RealReq = {
      ...req,
      messages: req.messages,
      model: req.model,
      stream: true,
    };
    for (const key in data) {
      if (ParamsList.indexOf(key) === -1) {
        delete (data as any)[key];
      }
    }
    try {
      const res = await child.client.post('/v1/chat/completions', data, {
        responseType: 'stream',
        headers: {
          accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
        },
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
            this.logger.info(`${req.model} recv ok`);
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            stream.write(Event.error, { error: 'not found data.choices' });
            stream.end();
            return;
          }
          const choices = data.choices || [];
          const { delta, finish_reason } = choices[0] || {};
          if (finish_reason === 'stop') {
            return;
          }
          if (delta) {
            stream.write(Event.message, delta);
          }
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      if (e.response && e.response.data) {
        e.message = await new Promise((resolve, reject) => {
          let content = '';
          e.response.data.on('data', (chunk: any) => {
            content += chunk.toString();
          });
          e.response.data.on('close', () => {
            const err = parseJSON<OpenaiError>(content, {
              error: { message: 'parse error json failed' },
            });
            child.handleError(err);
            this.logger.error(content);
            resolve(err?.error?.message || content);
          });
        });
      }
      this.logger.error(`openai failed: ${e.message}`);
      stream.write(Event.error, { error: e.message, status: e.status });
      stream.end();
    }
  }
}
