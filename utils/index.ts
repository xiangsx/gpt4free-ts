import es from 'event-stream';
import { PassThrough, pipeline, Stream } from 'stream';
import * as crypto from 'crypto';
import TurndownService from 'turndown';
import stringSimilarity from 'string-similarity';
//@ts-ignore
import UserAgent from 'user-agents';
import { get_encoding } from 'tiktoken';
import chalk from 'chalk';
import * as OpenCC from 'opencc-js';
import { ModelType } from '../model/base';
import moment, { max } from 'moment';
import { Config } from './config';
import path from 'path';
import { v4 } from 'uuid';
import fs, { createWriteStream } from 'fs';
import fileType from 'file-type';
import sizeOf from 'image-size';
import { CreateAxiosProxy, CreateNewAxios } from './proxyAgent';
import { promisify } from 'util';
import FormData from 'form-data';

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

export function randomNonce(length: number = 6): string {
  let result: string = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 9);
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
export type MessageData = {
  content: string;
  function_call?: { name: string; arguments: string };
  role?: string;
};
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
  protected model: ModelType = ModelType.GPT3p5Turbo;

  setModel(model: ModelType) {
    this.model = model;
  }

  constructor() {
    this.pt.setEncoding('utf-8');
  }

  public write<T extends Event>(event: T, data: Data<T>) {
    if (this.pt.writableEnded) {
      return;
    }
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
  private id: string = 'chatcmpl-' + '89C' + randomStr(26);
  private start: boolean = false;
  private created: number = moment().unix();

  write<T extends Event>(event: T, data: Data<T>) {
    if (this.pt.writableEnded) {
      return;
    }
    if (!this.start) {
      this.pt.write(
        `data: ${JSON.stringify({
          id: this.id,
          object: 'chat.completion.chunk',
          model: this.model,
          created: this.created,
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '' },
              finish_reason: null,
            },
          ],
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
            model: this.model,
            created: this.created,
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
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
            model: this.model,
            created: this.created,
            choices: [
              {
                index: 0,
                delta: { content: '', ...data },
                finish_reason: null,
              },
            ],
          })}\n\n`,
          'utf-8',
        );
        break;
      default:
        this.pt.write(
          `data: ${JSON.stringify({
            id: this.id,
            object: 'chat.completion.chunk',
            model: this.model,
            created: this.created,
            choices: [{ index: 0, delta: data, finish_reason: null }],
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

export class ClaudeEventStream extends EventStream {
  private log_id: string = randomStr(64).toLowerCase();

  write<T extends Event>(event: T, data: Data<T>) {
    if (this.pt.writableEnded) {
      return;
    }
    switch (event) {
      case Event.done:
        this.pt.write(
          `event: completion\ndata: ${JSON.stringify({
            completion: '',
            stop_reason: 'stop_sequence',
            model: this.model,
            stop: '\n\nHuman:',
            log_id: this.log_id,
          })}\n\n`,
          'utf-8',
        );
        break;
      case Event.message:
        this.pt.write(
          `event: completion\ndata: ${JSON.stringify({
            completion: (data as MessageData).content,
            stop_reason: null,
            model: this.model,
            stop: null,
            log_id: this.log_id,
          })}\n\n`,
          'utf-8',
        );
        break;
      default:
        break;
    }
  }

  read(dataCB: DataCB<Event>, closeCB: () => void) {
    this.pt.setEncoding('utf-8');
    this.pt.pipe(es.split(/\r?\n\r?\n/)).pipe(
      es.map(async (chunk: any, cb: any) => {
        if (chunk.indexOf('event: ping') > -1) {
          return;
        }
        const dataStr = chunk.replace('event: completion\ndata: ', '');
        if (!dataStr) {
          return;
        }
        const data = parseJSON<{ completion: string; stop: string }>(
          dataStr,
          {} as any,
        );
        if (!data.completion) {
          return;
        }
        dataCB(Event.message, { content: data.completion });
      }),
    );
    this.pt.on('close', () => {
      dataCB(Event.done, { content: '' });
      closeCB();
    });
  }
}

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
  private resolver?: () => void; // 更明确的类型
  private timeoutId?: NodeJS.Timeout;

  async lock(timeout = 5 * 60 * 1000) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      this.timeoutId = setTimeout(() => {
        this.locked = false;
        reject(new Error('Lock timeout'));
      }, timeout);
    });

    while (this.locked) {
      try {
        await Promise.race([
          new Promise<void>((resolve) => (this.resolver = resolve)),
          timeoutPromise,
        ]);
      } catch (error) {
        throw error;
      }
    }

    this.locked = true; // 现在在这里设置
    if (this.timeoutId) {
      clearTimeout(this.timeoutId); // 清除超时
      this.timeoutId = undefined;
    }
  }

  unlock() {
    if (!this.locked) {
      throw new Error('Cannot unlock a lock that is not locked');
    }
    this.locked = false;
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

const tokenizer = get_encoding('cl100k_base');

export function tokenEncode(input: string) {
  return tokenizer.encode(input);
}

export function getTokenCount(input: string) {
  return tokenEncode(input).length;
}

export class ComError extends Error {
  public status: number;
  public data?: any;

  static Status = {
    BadRequest: 400,
    ParamsError: 422,
    Unauthorized: 401,
    Forbidden: 403,
    NotFound: 404,
    InternalServerError: 500,
    RequestTooLarge: 413,
    RequestTooMany: 429,
    Overload: 503,
    Timeout: 504,
  };

  constructor(
    message?: string,
    code: number = ComError.Status.InternalServerError,
    data?: any,
  ) {
    super(message); // 调用父类构造函数

    Object.setPrototypeOf(this, ComError.prototype);

    this.name = this.constructor.name; // 设置错误的名称为当前类名
    this.status = code; // 设置错误代码
    this.data = data; // 其他数据
  }
}

export function removeRandomChars(str: string, percentage: number): string {
  const charsToRemove = Math.floor(str.length * percentage);
  return str.slice(0, str.length - charsToRemove - 2);
}

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

export function TWToCN(str: string) {
  return converter(str);
}

export function matchPattern(pattern: string, str: string): boolean {
  // First, escape special characters except for '*' and '?'
  const escapedPattern = pattern.replace(/[-\/\\^$+.()|[\]{}]/g, '\\$&');

  // Now, replace '*' with '.*' and '?' with '.'
  const regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');

  try {
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  } catch (e) {
    console.error(`Invalid pattern: ${pattern}`);
    return false;
  }
}

export function extractHttpURLs(text: string): string[] {
  // 正则表达式匹配以 "https" 开头，并在空格、"]"、或 ")" 之前结束的 URL
  const urlRegex = /https?:\/\/[^\s\]\)]*(?=\s|\]|\)|\n|\t|$)/g;
  return text.match(urlRegex) || [];
}

export function extractHttpFileURLs(text: string): string[] {
  // 正则表达式匹配以 "https" 开头，并在空格、"]"、或 ")" 之前结束的 带有文件后缀的 URL
  const urlRegex =
    /https?:\/\/[^\s\]\)]*\.(aac|abw|arc|avif|avi|azw|bin|bmp|bz|bz2|cda|csh|css|csv|doc|docx|eot|epub|gz|gif|heic|heif|htm|html|ico|ics|jar|jpeg|jpg|js|json|jsonld|mid|midi|mjs|mp3|mp4|mpeg|mpkg|odp|ods|odt|oga|ogv|ogx|opus|otf|png|pdf|php|ppt|pptx|rar|rtf|sh|svg|swf|tar|tif|tiff|ts|ttf|txt|vsd|wav|weba|webm|webp|woff|woff2|xhtml|xls|xlsx|xml|xul|zip|7z|mkv|mov|msg)(?=\s|\]|\)|\n|\t|$)/g;
  return text.match(urlRegex) || [];
}

// 过滤出符合条件的行
export function grepStr(v: string, filter: string | RegExp): string[] {
  const lines = v.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    if (typeof filter === 'string') {
      if (line.indexOf(filter) > -1) {
        result.push(line);
      }
    } else {
      line.match(filter)?.forEach((v) => result.push(v));
    }
  }
  return result;
}

export function replaceStrInBuffer(
  source: string,
  startIdx: number,
  endIdx: number,
  targetStr: string,
): string {
  // 将源字符串转换为 Buffer
  let buffer = Buffer.from(source);

  // 边界处理
  if (startIdx >= buffer.length) {
    return source;
  }

  if (endIdx > buffer.length) {
    endIdx = buffer.length;
  }

  // 计算目标字符串的长度
  const targetLength = Buffer.from(targetStr).length;

  // 计算要替换的部分的长度
  const replaceLength = endIdx - startIdx;

  // 创建一个新的 Buffer 用于存放结果
  let resultBuffer = Buffer.alloc(buffer.length - replaceLength + targetLength);

  // 将 startIdx 之前的部分复制到新 Buffer
  buffer.copy(resultBuffer, 0, 0, startIdx);

  // 将目标字符串添加到新 Buffer
  resultBuffer.write(targetStr, startIdx);

  // 将 endIdx 之后的部分复制到新 Buffer
  buffer.copy(resultBuffer, startIdx + targetLength, endIdx);

  return resultBuffer.toString();
}

export async function retryFunc<T>(
  func: () => Promise<T>,
  maxRetry: number,
  options: { label?: string; delay?: number; defaultV?: T; log?: boolean },
): Promise<T> {
  const { log = true, label, delay = 1000, defaultV } = options;
  for (let i = 0; i < maxRetry; i++) {
    try {
      return await func();
    } catch (e: any) {
      if (log) {
        console.error(
          `${label || 'retryFunc'} failed, retry ${
            i + 1
          }/${maxRetry} times. err:${e.message}`,
        );
      }
      await sleep(delay);
    }
  }
  if (defaultV === undefined) {
    throw new Error(`${options.label ?? 'retryFunc'} failed after retry`);
  }
  return defaultV;
}

export function extractJSON<T>(str: string): T | null {
  let start = -1;
  let bracketCount = 0;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      bracketCount++;
      if (start === -1) start = i;
    } else if (str[i] === '}') {
      bracketCount--;
      if (bracketCount === 0 && start !== -1) {
        try {
          let jsonStr = str.substring(start, i + 1);
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error('Found string is not a valid JSON');
          return null;
        }
      }
    }
  }

  console.error('No valid JSON found in the string');
  return null;
}

export function getFilenameFromContentDisposition(content: string = '') {
  const match = content.match(/filename=(.+)/);
  if (match) {
    return match[1];
  }
  return '';
}
const pipelinePromisified = promisify(pipeline);

const extMimeMapList: [string, string][] = [
  ['aac', 'audio/aac'],
  ['abw', 'application/x-abiword'],
  ['arc', 'application/x-freearc'],
  ['avif', 'image/avif'],
  ['avi', 'video/x-msvideo'],
  ['azw', 'application/vnd.amazon.ebook'],
  ['bin', 'application/octet-stream'],
  ['bmp', 'image/bmp'],
  ['bz', 'application/x-bzip'],
  ['bz2', 'application/x-bzip2'],
  ['cda', 'application/x-cdf'],
  ['csh', 'application/x-csh'],
  ['css', 'text/css'],
  ['csv', 'text/csv'],
  ['doc', 'application/msword'],
  [
    'docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['eot', 'application/vnd.ms-fontobject'],
  ['epub', 'application/epub+zip'],
  ['gz', 'application/gzip'],
  ['gif', 'image/gif'],
  ['heic', 'image/heic'],
  ['heif', 'image/heif'],
  ['htm', 'text/html'],
  ['html', 'text/html'],
  ['ico', 'image/vnd.microsoft.icon'],
  ['ics', 'text/calendar'],
  ['jar', 'application/java-archive'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['js', 'text/javascript'],
  ['json', 'application/json'],
  ['jsonld', 'application/ld+json'],
  ['mid', 'audio/midi'],
  ['midi', 'audio/midi'],
  ['mjs', 'text/javascript'],
  ['mp3', 'audio/mpeg'],
  ['mp4', 'video/mp4'],
  ['mpeg', 'video/mpeg'],
  ['mpkg', 'application/vnd.apple.installer+xml'],
  ['odp', 'application/vnd.oasis.opendocument.presentation'],
  ['ods', 'application/vnd.oasis.opendocument.spreadsheet'],
  ['odt', 'application/vnd.oasis.opendocument.text'],
  ['oga', 'audio/ogg'],
  ['ogv', 'video/ogg'],
  ['ogx', 'application/ogg'],
  ['opus', 'audio/opus'],
  ['otf', 'font/otf'],
  ['png', 'image/png'],
  ['pdf', 'application/pdf'],
  ['php', 'application/x-httpd-php'],
  ['ppt', 'application/vnd.ms-powerpoint'],
  [
    'pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  ['rar', 'application/vnd.rar'],
  ['rtf', 'application/rtf'],
  ['sh', 'application/x-sh'],
  ['svg', 'image/svg+xml'],
  ['swf', 'application/x-shockwave-flash'],
  ['tar', 'application/x-tar'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['ts', 'video/mp2t'],
  ['ttf', 'font/ttf'],
  ['txt', 'text/plain'],
  ['vsd', 'application/vnd.visio'],
  ['wav', 'audio/wav'],
  ['weba', 'audio/webm'],
  ['webm', 'video/webm'],
  ['webp', 'image/webp'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
  ['xhtml', 'application/xhtml+xml'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['xml', 'application/xml'],
  ['xul', 'application/vnd.mozilla.xul+xml'],
  ['zip', 'application/zip'],
  ['7z', 'application/x-7z-compressed'],
  ['mkv', 'video/x-matroska'],
  ['mov', 'video/quicktime'],
  ['msg', 'application/vnd.ms-outlook'],
];

export const extMimeMap = new Map(extMimeMapList);

const mimeExtMapList: [string, string][] = extMimeMapList.map(([ext, mime]) => [
  mime,
  ext,
]);

export const mimeExtMap = new Map(mimeExtMapList);

export async function downloadFile(fileUrl: string): Promise<{
  file_name: string;
  file_size: number;
  width: number;
  height: number;
  ext: string;
  mime: string;
  outputFilePath: string;
  image: boolean;
}> {
  let proxy = true;
  if (Config.config.global.download_map) {
    for (const old in Config.config.global.download_map) {
      if (fileUrl.indexOf(old) > -1) {
        fileUrl = fileUrl.replace(old, Config.config.global.download_map[old]);
        proxy = false;
      }
    }
  }
  try {
    let tempFilePath = path.join(Config.config.global.download.dir, v4());
    let filename!: string;
    if (fileUrl.startsWith('data:image/')) {
      // base64 写入文件
      const base64Data = fileUrl.replace(/^data:image\/\w+;base64,/, '');
      const dataBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tempFilePath, dataBuffer);
    } else {
      let ok = false;
      await retryFunc(
        async () => {
          const response = await CreateNewAxios({}, { proxy }).get(fileUrl, {
            responseType: 'stream',
            timeout: 10 * 1000,
            headers: {
              'User-Agent': randomUserAgent(),
            },
          });
          filename = getFilenameFromContentDisposition(
            response.headers['content-disposition'],
          );
          filename =
            filename || path.basename(response.request.path.split('?')[0]);
          let writer = createWriteStream(tempFilePath);
          await pipelinePromisified(response.data, writer);
          ok = true;
        },
        3,
        { label: 'downloadFile' },
      );
      if (!ok) {
        throw new ComError(`download failed`, ComError.Status.BadRequest);
      }
    }

    const ext =
      path.extname(filename).replace(/\./g, '').toLowerCase() || 'txt';
    const mime = extMimeMap.get(ext) || 'text/plain';
    let file_name = `${moment().format('YYYY-MM-DD-HH')}-${randomStr(
      20,
    )}.${ext}`;

    const file_size: number = fs.statSync(tempFilePath).size;
    const outputFilePath = path.join(
      Config.config.global.download.dir,
      file_name,
    );
    // Rename the temporary file to the final filename
    const result = {
      file_name,
      file_size,
      ext: ext.toLowerCase(),
      width: 1280,
      height: 720,
      mime,
      outputFilePath,
      image: mime.indexOf('image') > -1,
    };
    await fs.promises.rename(tempFilePath, outputFilePath);
    if (result.image) {
      const dimensions = sizeOf(outputFilePath);
      result.height = dimensions.height || 720;
      result.width = dimensions.width || 1280;
    }

    return result;
  } catch (e: any) {
    console.error(`download filed failed, url:${fileUrl}, err = ${e.message}`);
    throw e;
  }
}

export async function uploadFile(filePath: string): Promise<string> {
  return await retryFunc(
    async () => {
      let data = new FormData();
      data.append('file', fs.createReadStream(filePath));
      const res = await CreateNewAxios({
        baseURL: Config.config.global.cdn.url,
        timeout: 10000,
      })({
        method: 'post',
        maxBodyLength: Infinity,
        headers: {
          ...data.getHeaders(),
        },
        data: data,
      });
      const { code } = res.data;
      if (code !== 0) {
        throw new Error('upload file failed');
      }
      return res.data.data?.url || '';
    },
    3,
    { label: 'uploadFile' },
  );
}

export async function downloadAndUploadCDN(url: string): Promise<string> {
  try {
    const { outputFilePath } = await downloadFile(url);
    const newURL = await uploadFile(outputFilePath);
    return newURL || url;
  } catch (e) {
    return url;
  }
}
