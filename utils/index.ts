import es from 'event-stream';
import { PassThrough, Stream } from 'stream';
import * as crypto from 'crypto';
import TurndownService from 'turndown';
import stringSimilarity from 'string-similarity';
//@ts-ignore
import UserAgent from 'user-agents';
import { getEncoding } from 'js-tiktoken';
import chalk from 'chalk';

const turndownService = new TurndownService({ codeBlockStyle: 'fenced' });

type eventFunc = (eventName: string, data: string) => void;

export const TimeFormat = 'YYYY-MM-DD HH:mm:ss';
export function toEventCB(arr: Uint8Array, emit: eventFunc) {
  const pt = new PassThrough();
  pt.write(arr);
  pt.pipe(es.split(/\r?\n\r?\n/)) //split stream to break on newlines
    .pipe(
      es.map(async function (chunk: any, cb: Function) {
        //turn this async function into a stream
        const [eventStr, dataStr] = (chunk as any).split(/\r?\n/);
        const event = eventStr.replace(/event: /, '');
        const data = dataStr.replace(/data: /, '');
        emit(event, data);
        cb(null, { data, event });
      }),
    );
}

export function toEventStream(arr: Uint8Array): Stream {
  const pt = new PassThrough();
  pt.write(arr);
  return pt;
}

export function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

const charactersForRandom =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomStr(length: number = 6): string {
  let result = '';
  const charactersLength = charactersForRandom.length;
  for (let i = 0; i < length; i++) {
    result += charactersForRandom.charAt(
      Math.floor(Math.random() * charactersLength),
    );
  }
  return result;
}

export function parseJSON<T>(str: string, defaultObj: T): T {
  try {
    return JSON.parse(str);
  } catch (e: any) {
    return defaultObj;
  }
}

export function encryptWithAes256Cbc(data: string, key: string): string {
  const hash = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', hash, iv);

  let encryptedData = cipher.update(data, 'utf-8', 'hex');
  encryptedData += cipher.final('hex');

  return iv.toString('hex') + encryptedData;
}

export async function sleep(duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), duration);
  });
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

export type ErrorData = { error: string; message?: string; status?: number };
export type MessageData = { content: string };
export type SearchData = { search: any };
export type DoneData = MessageData;

export enum Event {
  error = 'error',
  message = 'message',
  search = 'search',
  done = 'done',
}

export type Data<T extends Event> = T extends Event.error
  ? ErrorData
  : T extends Event.message
  ? MessageData
  : T extends Event.done
  ? DoneData
  : T extends Event.search
  ? SearchData
  : any;

export type DataCB<T extends Event> = (event: T, data: Data<T>) => void;

export class EventStream {
  protected readonly pt: PassThrough = new PassThrough();

  constructor() {
    this.pt.setEncoding('utf-8');
  }

  public write<T extends Event>(event: T, data: Data<T>) {
    this.pt.write(`event: ${event}\n`, 'utf-8');
    this.pt.write(`data: ${JSON.stringify(data)}\n\n`, 'utf-8');
  }

  stream() {
    return this.pt;
  }

  end(cb?: () => void) {
    this.pt.end(cb);
  }

  public read(dataCB: DataCB<Event>, closeCB: () => void) {
    this.pt.setEncoding('utf-8');
    this.pt.pipe(es.split('\n\n')).pipe(
      es.map(async (chunk: any, cb: any) => {
        const res = chunk.toString();
        if (!res) {
          return;
        }
        const [eventStr, dataStr] = res.split('\n');
        const event: Event = eventStr.replace('event: ', '');
        if (!(event in Event)) {
          dataCB(Event.error, {
            error: `EventStream data read failed, not support event ${eventStr}, ${dataStr}`,
          });
          return;
        }
        const data = parseJSON(
          dataStr.replace('data: ', ''),
          {} as Data<Event>,
        );
        dataCB(event, data);
      }),
    );
    this.pt.on('close', closeCB);
  }
}

export class ThroughEventStream extends EventStream {
  private onData?: <T extends Event>(event: T, data: Data<T>) => void;
  private onEnd?: () => void;

  constructor(
    onData: <T extends Event>(event: T, data: Data<T>) => void,
    onEnd: () => void,
  ) {
    super();
    this.onData = onData;
    this.onEnd = onEnd;
  }

  destroy() {
    this.onData = undefined;
    this.onEnd = undefined;
  }

  public write<T extends Event>(event: T, data: Data<T>) {
    this.onData?.(event, data);
  }

  public end() {
    this.onEnd?.();
  }
}

export class OpenaiEventStream extends EventStream {
  private id: string = 'chatcmpl-' + randomStr() + randomStr();
  private start: boolean = false;

  write<T extends Event>(event: T, data: Data<T>) {
    if (!this.start) {
      this.pt.write(
        `data: ${JSON.stringify({
          id: this.id,
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: { role: 'assistant', content: '' } }],
          finish_reason: null,
        })}\n\n`,
        'utf-8',
      );
      this.start = true;
    }
    switch (event) {
      case Event.done:
        this.pt.write(
          `data: ${JSON.stringify({
            id: this.id,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            finish_reason: 'stop',
          })}\n\n`,
          'utf-8',
        );
        this.pt.write(`data: [DONE]\n\n`, 'utf-8');
        break;
      case Event.search:
        this.pt.write(
          `data: ${JSON.stringify({
            id: this.id,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: '', ...data } }],
            finish_reason: null,
          })}\n\n`,
          'utf-8',
        );
        break;
      default:
        this.pt.write(
          `data: ${JSON.stringify({
            id: this.id,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: data }],
            finish_reason: null,
          })}\n\n`,
          'utf-8',
        );
        break;
    }
  }

  read(dataCB: DataCB<Event>, closeCB: () => void) {
    this.pt.setEncoding('utf-8');
    this.pt.pipe(es.split(/\r?\n\r?\n/)).pipe(
      es.map(async (chunk: any, cb: any) => {
        const dataStr = chunk.replace('data: ', '');
        if (!dataStr) {
          return;
        }
        if (dataStr === '[DONE]') {
          dataCB(Event.done, { content: '' });
          return;
        }
        const data = parseJSON(dataStr, {} as any);
        if (!data?.choices) {
          dataCB(Event.error, { error: `EventStream data read failed` });
          return;
        }
        const [
          {
            delta: { content = '' },
            finish_reason,
          },
        ] = data.choices;
        dataCB(Event.message, { content });
      }),
    );
    this.pt.on('close', closeCB);
  }
}

export const getTokenSize = (str: string) => {
  return str.length;
};

export const htmlToMarkdown = (html: string): string => {
  return turndownService.turndown(html);
};

export const isSimilarity = (s1: string, s2: string): boolean => {
  const similarity = stringSimilarity.compareTwoStrings(s1, s2);
  return similarity > 0.3;
};

export const randomUserAgent = (): string => {
  return new UserAgent().toString();
};

export function extractStrNumber(input: string): number {
  // 使用正则表达式匹配所有的数字
  let matches = input.match(/\d+/g);
  if (matches) {
    // 将所有匹配的数字组合成一个新的字符串
    let numberString = matches.join('');
    // 将新的字符串转换为整数
    return parseInt(numberString);
  }
  // 如果输入的字符串中没有数字，返回0
  return 0;
}

export function maskLinks(input: string): string {
  // 定义一个正则表达式，用于匹配http或https的链接
  const linkRegex =
    /(http|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/g;

  // 使用replace方法将所有的链接的http或https部分替换为"htxxp://"或"htxxps://"的字样
  const output = input.replace(linkRegex, function (match: string) {
    return match.replace(/http/g, 'htxxp');
  });

  return output;
}

export class Lock {
  private locked = false;
  private resolver?: Function;
  private timeoutId?: NodeJS.Timeout;

  async lock(timeout = 5 * 60 * 1000) {
    const timeoutPromise = new Promise((resolve, reject) => {
      this.timeoutId = setTimeout(() => {
        this.locked = false;
        reject(new Error('Lock timeout'));
      }, timeout);
    });

    while (this.locked) {
      try {
        await Promise.race([
          new Promise((resolve) => (this.resolver = resolve)),
          timeoutPromise,
        ]);
      } catch (error) {
        throw error;
      }
    }
    this.locked = true;
  }

  unlock() {
    if (!this.locked) {
      throw new Error('Cannot unlock a lock that is not locked');
    }
    this.locked = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.resolver) {
      const resolve = this.resolver;
      this.resolver = undefined;
      resolve();
    }
  }
}

export function encodeBase64(
  buffer: Buffer,
  padded = false,
  urlSafe = true,
): string {
  let base64 = buffer.toString('base64');

  if (!padded) {
    base64 = base64.replace(/=+$/, '');
  }

  if (urlSafe) {
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_');
  }

  return base64;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function colorLabel(label: string) {
  const hash = hashString(label);
  const colors = [
    chalk.redBright,
    chalk.greenBright,
    chalk.yellowBright,
    chalk.blueBright,
    chalk.magentaBright,
    chalk.cyanBright,
    chalk.whiteBright,
    chalk.red,
    chalk.green,
    chalk.yellow,
    chalk.blue,
    chalk.magenta,
    chalk.cyan,
    chalk.white,
  ];
  const color = colors[hash % colors.length];
  if (typeof color !== 'function') {
    console.log(color);
  }
  return color(label);
}

export function getRandomOne<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const tokenizer = getEncoding('cl100k_base');

export function tokenEncode(input: string): Uint32Array {
  return new Uint32Array(tokenizer.encode(input));
}

export function getTokenCount(input: string) {
  return tokenEncode(input).length;
}

export class ComError extends Error {
  public status: number;

  static Status = {
    BadRequest: 400,
    Unauthorized: 401,
    Forbidden: 403,
    NotFound: 404,
    InternalServerError: 500,
    RequestTooLarge: 413,
    RequestTooMany: 429,
    Overload: 503,
  };

  constructor(
    message?: string,
    code: number = ComError.Status.InternalServerError,
  ) {
    super(message); // 调用父类构造函数

    Object.setPrototypeOf(this, ComError.prototype);

    this.name = this.constructor.name; // 设置错误的名称为当前类名
    this.status = code; // 设置错误代码
  }
}
