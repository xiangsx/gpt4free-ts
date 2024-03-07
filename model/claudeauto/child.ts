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
import moment from 'moment';
import { clearTimeout } from 'node:timers';

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

  use(): void {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
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

  async askMessagesStream(req: MessagesReq) {
    const data: MessagesReq = {
      ...req,
      messages: req.messages,
      model: req.model,
      stream: true,
      system: '',
      max_tokens:
        !req.max_tokens || req.max_tokens > 4096 ? 4096 : req.max_tokens,
    };
    if (data.messages[0].role !== 'user') {
      data.messages = [{ role: 'user', content: '..' }, ...data.messages];
    }
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
    const res = await this.client.post('/v1/messages', data, {
      responseType: 'stream',
      headers: {
        'x-api-key': this.info.apikey,
      },
    } as AxiosRequestConfig);
    return res.data;
  }
}
