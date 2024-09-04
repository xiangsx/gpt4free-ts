import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  getImagesFromContent,
  Message,
  ModelType,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import {
  CreateAxiosProxy,
  CreateNewAxios,
  downloadImageToBase64,
} from '../../utils/proxyAgent';
import es from 'event-stream';
import { ComError, Event, EventStream, parseJSON } from '../../utils';
import { AsyncStoreSN } from '../../asyncstore';

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

interface MessagesReq extends ChatRequest {
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
  system?: string;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: {};
  user?: string;
}

interface ClaudeChatOptions extends ChatOptions {
  base_url?: string;
  api_key?: string;
  proxy?: boolean;
  model_map?: { [key: string]: ModelType };
}

const MessagesParamsList = ['model', 'messages', 'stream', 'max_tokens'];

const ParamsList = [
  'model',
  'prompt',
  'max_tokens_to_sample',
  'stop_sequences',
  'temperature',
  'top_p',
  'top_k',
  'metadata',
  'stream',
];

export class ClaudeAPI extends Chat {
  private client: AxiosInstance;
  protected options?: ClaudeChatOptions;

  constructor(options?: ClaudeChatOptions) {
    super(options);
    this.client = CreateNewAxios(
      {
        baseURL: options?.base_url || 'https://api.anthropic.com/',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
          'x-api-key': `${options?.api_key || ''}`,
          'anthropic-version': '2023-06-01',
        },
      } as CreateAxiosDefaults,
      {
        proxy: options?.proxy,
      },
    );
  }

  support(model: ModelType): number {
    return Number.MAX_SAFE_INTEGER;
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
    const reqH = await super.preHandle(req, {
      token: true,
      countPrompt: false,
      forceRemove: false,
    });
    if (this.options?.model_map && this.options.model_map[req.model]) {
      reqH.model = this.options.model_map[req.model];
    }
    reqH.prompt =
      reqH.messages
        .map(
          (v) =>
            `\n\n${v.role === 'assistant' ? 'Assistant' : 'Human'}: ${
              v.content
            }`,
        )
        .join() + '\n\nAssistant:';
    return reqH;
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
          'x-api-key': `${this.options?.api_key || req.secret || ''}`,
          'x-request-id': AsyncStoreSN.getStore()?.sn,
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
      });
    } catch (e: any) {
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

  public async askStream(req: ChatRequest, stream: EventStream) {
    if (req.model.startsWith('claude-3')) {
      return this.askMessagesStream(req as MessagesReq, stream);
    }
    const data: RealReq = {
      max_tokens_to_sample: 100 * 10000,
      ...req,
      prompt: req.prompt,
      model: req.model,
      stream: true,
    };
    for (const key in data) {
      if (ParamsList.indexOf(key) === -1) {
        delete (data as any)[key];
      }
    }
    try {
      const res = await this.client.post('/v1/complete', data, {
        responseType: 'stream',
        headers: {
          'x-api-key': `${this.options?.api_key || req.secret || ''}`,
        },
      } as AxiosRequestConfig);
      let old = '';
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('event: completion\r\ndata: ', '');
          if (!dataStr) {
            return;
          }
          const data = parseJSON<{ completion: string }>(dataStr, {} as any);
          if (!data.completion) {
            return;
          }
          if (!data.completion) {
            return;
          }
          old += data.completion;
          stream.write(Event.message, { content: data.completion });
        }),
      );
      res.data.on('close', () => {
        if (old.trim().length === 0) {
          stream.write(Event.error, { error: 'no response' });
        }
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      this.logger.error(
        `ask stream failed, apikey:${
          (this.options as ClaudeChatOptions).api_key
        } ${e.message}`,
      );
      e.response?.data.on('data', (chunk: any) =>
        console.log(
          `ask stream failed, apikey:${
            (this.options as ClaudeChatOptions).api_key
          }`,
          chunk.toString(),
        ),
      );
      throw new ComError(e.message, e.response?.status);
    }
  }
}
