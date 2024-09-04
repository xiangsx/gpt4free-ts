import { ComChild, DestroyOptions } from '../../utils/pool';
import { Account, Conversation } from './define';
import { AxiosInstance } from 'axios';
import { CreateNewAxios } from '../../utils/proxyAgent';
import { Event, EventStream, parseJSON, randomUserAgent } from '../../utils';
import { ChatRequest } from '../base';
import es from 'event-stream';
import moment from 'moment/moment';
import { v4 } from 'uuid';

export class Child extends ComChild<Account> {
  private client: AxiosInstance = CreateNewAxios(
    {
      baseURL: 'https://chat.openai.com',
      timeout: 10 * 1000,
      headers: {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'oai-language': 'en-US',
        origin: 'https://chat.openai.com',
        pragma: 'no-cache',
        referer: 'https://chat.openai.com',
        'user-agent': randomUserAgent(),
      },
    },
    { proxy: true },
  );
  private oaiDid!: string;
  private token!: any;
  private itl?: any;

  constructor(label: string, info: Account, options?: any) {
    super(label, info, options);
  }

  async updateSessionID() {
    this.oaiDid = v4();
    const response = await this.client.post(
      `/backend-anon/sentinel/chat-requirements`,
      {},
      {
        headers: { 'oai-device-id': this.oaiDid },
      },
    );
    this.token = response.data.token;
  }

  async askForStream(req: ChatRequest, stream: EventStream) {
    const body = {
      action: 'next',
      messages: req.messages.map((v) => ({
        author: { role: v.role },
        content: { content_type: 'text', parts: [v.content] },
      })),
      parent_message_id: v4(),
      model: 'text-davinci-002-render-sha',
      timezone_offset_min: -180,
      suggestions: [],
      history_and_training_disabled: true,
      conversation_mode: { kind: 'primary_assistant' },
      websocket_request_id: v4(),
    };
    const response = await this.client
      .post('/backend-api/conversation', body, {
        responseType: 'stream',
        headers: {
          'oai-device-id': this.oaiDid,
          'openai-sentinel-chat-requirements-token': this.token,
        },
      })
      .catch((e) => {
        this.destroy({ delMem: true, delFile: true });
        stream.write(Event.error, { error: e.message });
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    if (!response) {
      return;
    }
    const ss = response.data.pipe(es.split(/\r?\n\r?\n/));
    let old = '';
    ss.on('data', (chunk: string) => {
      try {
        const dataStr = chunk.replace('data: ', '');
        if (!dataStr) {
          return;
        }
        if (dataStr === '[DONE]') {
          return;
        }
        const data = parseJSON<Conversation>(dataStr, {} as Conversation);
        if (!data.message) {
          return;
        }
        if (data.message.author.role !== 'assistant') {
          return;
        }
        if (data.message.status === 'finished_successfully') {
          return;
        }
        const content = (data.message?.content?.parts?.[0] as string) || '';
        stream.write(Event.message, { content: content.substring(old.length) });
        old = content;
      } catch (e) {
        this.logger.error(e);
      }
    });
    ss.on('close', () => {
      this.logger.info('recv ok');
      stream.write(Event.done, { content: '' });
      stream.end();
    });
  }

  async init() {
    await this.updateSessionID();
    this.itl = setInterval(() => {
      this.updateSessionID().catch((e) => {
        this.logger.error(e.message);
        this.destroy({ delMem: true, delFile: true });
        clearInterval(this.itl);
      });
    }, 60 * 1000);
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }
  destroy(options?: DestroyOptions) {
    if (this.itl) {
      clearInterval(this.itl);
    }
  }
}
