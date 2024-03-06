import { ComChild } from '../../utils/pool';
import { Account, MessagesParamsList, MessagesReq } from './define';
import {
  ComError,
  Event,
  EventStream,
  getRandomOne,
  parseJSON,
} from '../../utils';
import { contentToString, getImagesFromContent, Message } from '../base';
import { CreateNewAxios, downloadImageToBase64 } from '../../utils/proxyAgent';
import { AsyncStoreSN } from '../../asyncstore';
import { AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import es from 'event-stream';
import { Config } from '../../utils/config';
import { AwsLambda } from 'elastic-apm-node/types/aws-lambda';

export class Child extends ComChild<Account> {
  private client = CreateNewAxios(
    {
      baseURL: 'https://api.anthropic.com/',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Proxy-Connection': 'keep-alive',
        'x-api-key': this.info.apikey,
        'anthropic-version': '2023-06-01',
      },
    } as CreateAxiosDefaults,
    {
      proxy: getRandomOne(Config.config.claudeauto!.proxy_list),
    },
  );

  async init(): Promise<void> {
    if (!this.info.apikey) {
      throw new Error('apikey empty');
    }
    await this.checkChat();
  }

  async checkChat() {
    const res = await this.client.post('/v1/messages', {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      stream: false,
      messages: [{ role: 'user', content: 'say 1' }],
    });
    if (res.data.error) {
      throw new ComError(JSON.stringify(res.data));
    }
    console.log('check chat ok');
  }

  async askMessagesStream(req: MessagesReq, stream: EventStream) {
    const data: MessagesReq = {
      ...req,
      messages: req.messages,
      model: req.model,
      stream: true,
      system: '',
      max_tokens:
        !req.max_tokens || req.max_tokens > 4096 ? 4096 : req.max_tokens,
    };
    for (const v of data.messages) {
      if (v.role === 'system') {
        v.role = 'user';
        data.system = contentToString(v.content);
        continue;
      }
      const images = getImagesFromContent(v.content);
      if (images.length > 0) {
        let text = contentToString(v.content);
        v.content = [];
        // 过滤掉图片链接
        for (const image of images) {
          text = text.replace(image, '');
          if (image.indexOf('base64') > -1) {
            const media_type = image.split(';')[0].split(':')[1];
            const data = image.split(',')[1];
            v.content.push({
              // @ts-ignore
              type: 'image',
              source: { type: 'base64', media_type, data },
            });
          } else {
            const { mimeType: media_type, base64Data: data } =
              await downloadImageToBase64(image);
            v.content.push({
              // @ts-ignore
              type: 'image',
              source: { type: 'base64', media_type, data },
            });
          }
        }
        v.content.push({ type: 'text', text: text || '..' });
      } else {
        v.content = contentToString(v.content) || '..';
      }
    }
    const newMessages: Message[] = [];
    for (let idx = 0; idx < data.messages.length; idx++) {
      if (idx === 0) {
        newMessages.push(data.messages[idx]);
        continue;
      }
      const v = data.messages[idx];
      const lastV = data.messages[idx - 1];
      if (v.role === lastV.role) {
        if (lastV.role === 'assistant') {
          newMessages.push({ role: 'user', content: '..' });
        } else {
          newMessages.push({ role: 'assistant', content: '..' });
        }
      }
      newMessages.push(v);
    }
    data.messages = newMessages;
    for (const key in data) {
      if (MessagesParamsList.indexOf(key) === -1) {
        delete (data as any)[key];
      }
    }
    try {
      const res = await this.client.post('/v1/messages', data, {
        responseType: 'stream',
        headers: {
          'x-api-key': this.info.apikey,
        },
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.split('\n')[1]?.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
            return;
          }
          const data = parseJSON<{
            content_block: { text: string };
            delta: { text: string };
            type:
              | 'message_stop'
              | 'message_delta'
              | 'content_block_stop'
              | 'content_block_start';
          }>(dataStr, {} as any);
          if (data.delta) {
            stream.write(Event.message, { content: data.delta.text });
            return;
          }
          if (data.content_block) {
            stream.write(Event.message, { content: data.content_block.text });
            return;
          }
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
        this.release();
        this.logger.info('Recv ok');
      });
    } catch (e: any) {
      this.release();
      if (e.response && e.response.data) {
        e.message = await new Promise((resolve, reject) => {
          e.response.data.on('data', (chunk: any) => {
            const content = chunk.toString();
            this.logger.error(content);
            resolve(
              parseJSON<{ error?: { message?: string } }>(content, {})?.error
                ?.message || content,
            );
          });
        });
      }
      this.logger.error(`claude messages failed: ${e.message}`);
      stream.write(Event.error, { error: e.message, status: e.status });
      stream.end();
    }
  }
}
