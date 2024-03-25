import { ComChild } from '../../utils/pool';
import { Account, MessagesParamsList, MessagesReq } from './define';
import {
  ComError,
  Event,
  EventStream,
  extractFileToText,
  getRandomOne,
  isImageURL,
  parseJSON,
} from '../../utils';
import {
  contentToString,
  getFilesFromContent,
  getImagesFromContent,
  Message,
} from '../base';
import { CreateNewAxios, downloadImageToBase64 } from '../../utils/proxyAgent';
import { AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { Config } from '../../utils/config';
import moment from 'moment';

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
      timeout: 30 * 1000,
    } as CreateAxiosDefaults,
    {
      proxy: getRandomOne(Config.config.claudeauto!.proxy_list),
    },
  );

  async init(): Promise<void> {
    try {
      if (!this.info.apikey) {
        throw new Error('apikey empty');
      }
      await this.checkChat();
    } catch (err: any) {
      if (
        err.response?.data?.error?.message?.indexOf?.(
          'Your credit balance is too low',
        ) > -1
      ) {
        this.update({ low_credit: true });
      }
      if (
        err.response?.data?.error?.message?.indexOf?.(
          'This organization has been disabled',
        ) > -1
      ) {
        this.update({ banned: true });
      }
      if (err?.response?.status === 401) {
        this.update({ banned: true });
      }
      this.logger.error(
        `init error: ${err.message} ${JSON.stringify(err.response?.data)}`,
      );
      throw err;
    }
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
    this.logger.info('check chat ok');
  }

  async askMessagesStream(req: MessagesReq) {
    const data: MessagesReq = {
      ...req,
      messages: [...req.messages.map((v) => ({ ...v }))],
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
      const files = getFilesFromContent(v.content);
      const images: string[] = [];
      const docs: string[] = [];
      for (const v of files) {
        if (isImageURL(v)) {
          images.push(v);
        } else {
          docs.push(v);
        }
      }
      let text = contentToString(v.content);
      if (docs.length > 0) {
        for (const doc of docs) {
          text = text.replace(doc, '');
        }
        let fileTexts = await Promise.all(
          docs.map((v) => extractFileToText(v)),
        );
        fileTexts = fileTexts.map((v) => v.slice(0, 10000));
        text = `Here are some documents for you to reference for your task: \n${fileTexts
          .map(
            (v, idx) => `<documents>
<document index='${idx}'>
<source>
${docs[idx]}
</source>
<document_content>
${v}
</document_content>
</document>`,
          )
          .join('\n')}\n${text}`;
      }
      if (images.length > 0) {
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
        v.content = text;
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
