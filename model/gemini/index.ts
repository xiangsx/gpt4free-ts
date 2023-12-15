import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  Message,
  ModelType,
} from '../base';
import { AxiosInstance } from 'axios';
import { CreateNewAxios, downloadImageToBase64 } from '../../utils/proxyAgent';
import {
  ComError,
  Event,
  EventStream,
  extractHttpURLs,
  getRandomOne,
  parseJSON,
} from '../../utils';
import {
  Content,
  GenerateContentRequest,
  GenerateContentResponse,
  HarmBlockThreshold,
  HarmCategory,
  Part,
} from '@google/generative-ai';
import { ComChild, ComInfo, Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import es from 'event-stream';
import moment from 'moment';

interface Account extends ComInfo {
  apikey: string;
}

class Child extends ComChild<Account> {
  client: AxiosInstance = CreateNewAxios(
    {
      baseURL: 'https://generativelanguage.googleapis.com',
    },
    { proxy: getRandomOne(Config.config.proxy_pool.stable_proxy_list) },
  );

  init(): Promise<void> {
    return Promise.resolve();
  }

  use() {
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this.info.useCount || 0) + 1,
    });
  }

  getMimeTypeFromBase64(base64: string) {
    const base64Str = base64.split(';base64,')[0];
    return base64Str.split(':')[1];
  }

  async messageToContent(
    v: Message,
    filterImage: boolean,
  ): Promise<[Content[], boolean]> {
    if (v.role === 'assistant') {
      return [
        [
          {
            role: 'model',
            parts: [{ text: contentToString(v.content) }],
          },
        ],
        false,
      ];
    }
    if (v.role === 'system') {
      return [
        [
          {
            role: 'user',
            parts: [{ text: contentToString(v.content) }],
          },
          {
            role: 'model',
            parts: [{ text: 'Got it!' }],
          },
        ],
        false,
      ];
    }

    const content = { role: 'user', parts: [] as Part[] } as Content;
    const imageUrls = [];
    if (typeof v.content === 'string') {
      const urls = extractHttpURLs(v.content);
      imageUrls.push(...urls);
      for (const url of urls) {
        v.content = v.content.replace(url, '');
      }
      content.parts.push({ text: v.content });
    } else {
      for (const c of v.content) {
        if (typeof c === 'string') {
          content.parts.push({ text: c });
          continue;
        }
        if (c.type !== 'image_url') {
          if (c.text) {
            content.parts.push({ text: c.text });
          }
          continue;
        }
        if (typeof c.image_url === 'string') {
          if (!c.image_url) {
            continue;
          }
          imageUrls.push(c.image_url);
          continue;
        }
        if (!c.image_url?.url) {
          continue;
        }
        imageUrls.push(c.image_url.url);
      }
    }
    let hasImage = false;
    if (!filterImage) {
      // downloadImageToBase64()
      const base64List = await Promise.all(
        imageUrls.map(downloadImageToBase64),
      );
      hasImage = base64List.length > 0;
      content.parts.push(
        ...base64List.map((v) => ({
          inlineData: { data: v.base64Data, mimeType: v.mimeType },
        })),
      );
    }
    return [[content], hasImage];
  }

  async generateContentStream(model: ModelType, messages: Message[]) {
    const data = {
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
      generationConfig: {
        // candidateCount:
        // stopSequences
        maxOutputTokens: model === ModelType.GeminiProVision ? 2000 : 4000,
        temperature: 1,
        // topP: 1,
        // topK: 1,
      },
      contents: [],
    } as GenerateContentRequest;
    let targetMessages = messages;
    let targetModel = model;
    if (model === ModelType.GeminiProVision) {
      targetMessages = messages.slice(messages.length - 1, messages.length);
      const [content, hasImage] = await this.messageToContent(
        targetMessages[0],
        false,
      );
      if (hasImage) {
        data.contents.push(...content);
        return this.client.post(
          `/v1beta/models/${model}:streamGenerateContent?key=${this.info.apikey}&alt=sse`,
          data,
          {
            responseType: 'stream',
          },
        );
      }
      targetModel = ModelType.GeminiPro;
      targetMessages = messages;
    }
    for (const v of targetMessages) {
      const [content] = await this.messageToContent(v, true);
      data.contents.push(...content);
    }
    return this.client.post(
      `/v1beta/models/${targetModel}:streamGenerateContent?key=${this.info.apikey}&alt=sse`,
      data,
      {
        responseType: 'stream',
      },
    );
  }
}

export class Gemini extends Chat {
  protected options?: ChatOptions;
  private pool: Pool<Account, Child> = new Pool(
    this.options?.name || '',
    () => Config.config.gemini.size,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.apikey) {
        return false;
      }
      return true;
    },
    {
      delay: 3000,
      serial: () => Config.config.gemini.serial || 1,
      needDel: (v) => !v.apikey,
      preHandleAllInfos: async (infos) => {
        const apiSet = new Map(infos.map((v) => [v.apikey, v]));
        for (const v of Config.config.gemini.apikeys) {
          if (apiSet.has(v)) {
            const info = apiSet.get(v)!;
            continue;
          }
          const newA = {
            id: v4(),
            apikey: v,
          } as Account;
          apiSet.set(v, newA);
          infos.push(newA);
        }
        return infos;
      },
    },
  );

  constructor(options?: ChatOptions) {
    super(options);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GeminiPro:
        return 30000;
      case ModelType.GeminiProVision:
        return 10000;
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
    return super.preHandle(req, options);
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    try {
      const res = await child.generateContentStream(req.model, req.messages);
      const response = res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map((chunk: any, cb: any) => {
          if (!chunk) {
            return;
          }
          const content = parseJSON<GenerateContentResponse>(
            chunk.toString().replace('data: ', ''),
            {} as any,
          );
          for (const v of content.candidates || []) {
            if (!v.content?.parts) {
              continue;
            }
            cb(null, v.content.parts[0].text || '');
          }
        }),
      );
      const delay = setTimeout(() => {
        stream.write(Event.done, { content: '' });
        stream.end();
      }, 5000);
      response.on('data', (content: string) => {
        delay.refresh();
        stream.write(Event.message, { content: content });
      });
    } catch (e: any) {
      e.response.data.on('data', (chunk: any) =>
        this.logger.error(chunk.toString()),
      );
      console.error(e.message);
      throw new ComError(e.message, ComError.Status.InternalServerError);
    }
  }
}
