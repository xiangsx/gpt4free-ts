import { Chat, ChatOptions, ChatRequest, ModelType } from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import { Event, EventStream } from '../../utils';

export class Toyy extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'http://toyy.one',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Proxy-Connection': 'keep-alive',
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.GPT3p5_16k:
        return 12000;
      case ModelType.GPT4:
        return 6000;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    try {
      const xe = new Date().getTime();
      const message:string = JSON.stringify([{"role":"user","content":req.prompt}]);
      const res = await this.client.get(
          `/api/ai/common/chatgpt?model=${req.model}&userInput=${req.prompt}&clientSendTime=${xe}&phone=&key=${this.uR(xe + "")}&messages=${message}`,
        {
          responseType: 'stream',
        } as AxiosRequestConfig,
      );
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (dataStr === '[DONE]') {
            return;
          }
          stream.write(Event.message, { content: eval("'" + dataStr + "'") });
        }),
      );
      res.data.on('close', () => {
        stream.write(Event.done, { content: '' });
        stream.end();
      });
    } catch (e: any) {
      console.error(e.message);
      throw e;
    }
  }
  uR(e:string) {
    const t = "snkliduffkdslsuerdjfkfhdssdfder";
    let n = "";
    for (let s = 0; s < e.length; s++) {
      const o = e.charCodeAt(s)
          , a = t[s % t.length].charCodeAt(0)
          , l = o ^ a;
      n += String.fromCharCode(l)
    }
    return n
  }
}
