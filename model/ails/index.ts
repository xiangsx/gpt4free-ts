import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  contentToString,
  Message,
  ModelType,
} from '../base';
import { AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from 'axios';
import { CreateAxiosProxy } from '../../utils/proxyAgent';
import es from 'event-stream';
import {
  ErrorData,
  Event,
  EventStream,
  MessageData,
  parseJSON,
} from '../../utils';
import { createHash } from 'crypto';
import moment from 'moment';
import { v4 } from 'uuid';

interface RealReq {
  messages: Message[];
  model: string;
  temperature: number;
  presence_penalty: number;
  top_p: number;
  frequency_penalty: number;
  stream: boolean;
}

class Utils {
  static hash(json_data: { t: number; m: string }): string {
    const secretKey: number[] = [
      79, 86, 98, 105, 91, 84, 80, 78, 123, 83, 35, 41, 99, 123, 51, 54, 37, 57,
      63, 103, 59, 117, 115, 108, 41, 67, 76,
    ];

    const base_string: string = `${json_data['t']}:${json_data['m']}:'WI,2rU#_r:r~aF4aJ36[.Z(/8Rv93Rf':${json_data['m'].length}`;

    return createHash('sha256').update(base_string).digest('hex');
  }

  static format_timestamp(timestamp: number): string {
    const e = timestamp;
    const n = e % 10;
    const r = n % 2 === 0 ? n + 1 : n;
    return String(e - n + r);
  }
}

export class AILS extends Chat {
  private client: AxiosInstance;

  constructor(options?: ChatOptions) {
    super(options);
    this.client = CreateAxiosProxy(
      {
        baseURL: 'https://api.caipacity.com',
        headers: {
          authority: 'api.caipacity.com',
          accept: '*/*',
          'accept-language':
            'en,fr-FR;q=0.9,fr;q=0.8,es-ES;q=0.7,es;q=0.6,en-US;q=0.5,am;q=0.4,de;q=0.3',
          authorization: 'Bearer free',
          'client-id': v4(),
          'client-v': '0.1.249',
          'content-type': 'application/json',
          origin: 'https://ai.ls',
          referer: 'https://ai.ls/',
          'sec-ch-ua':
            '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        },
      } as CreateAxiosDefaults,
      false,
    );
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT3p5Turbo:
        return 2500;
      default:
        return 0;
    }
  }

  public async askStream(req: ChatRequest, stream: EventStream) {
    const now = moment().valueOf();
    const data = {
      model: 'gpt-3.5-turbo',
      temperature: 1,
      stream: true,
      messages: req.messages,
      d: moment().format('YYYY-MM-DD'),
      t: `${now}`,
      s: Utils.hash({
        t: now,
        m: contentToString(req.messages[req.messages.length - 1].content),
      }),
    };
    try {
      const res = await this.client.post('/v1/chat/completions', data, {
        responseType: 'stream',
      } as AxiosRequestConfig);
      res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(
        es.map(async (chunk: any, cb: any) => {
          const dataStr = chunk.replace('data: ', '');
          if (!dataStr) {
            return;
          }
          if (dataStr === '[DONE]') {
            stream.write(Event.done, { content: '' });
            stream.end();
            return;
          }
          const data = parseJSON(dataStr, {} as any);
          if (!data?.choices) {
            stream.write(Event.error, { error: 'not found data.choices' });
            stream.end();
            return;
          }
          const [
            {
              delta: { content = '' },
              finish_reason,
            },
          ] = data.choices;
          if (finish_reason === 'stop') {
            return;
          }
          stream.write(Event.message, { content });
        }),
      );
    } catch (e: any) {
      console.error(e.message);
      stream.write(Event.error, { error: e.message });
      stream.end();
    }
  }
}
