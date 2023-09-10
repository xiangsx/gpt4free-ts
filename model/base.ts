import {
  ComError,
  ErrorData,
  Event,
  EventStream,
  getTokenCount,
  MessageData,
} from '../utils';
import winston from 'winston';
import { newLogger } from '../utils/log';

export interface ChatOptions {
  name: string;
}

export interface ChatResponse {
  content?: string;
  error?: string;
}

export type Message = {
  role: string;
  content: string;
};

export enum ModelType {
  GPT3p5Turbo = 'gpt-3.5-turbo',
  GPT3p5TurboHaining = 'gpt-3.5-turbo-haining',
  GPT3p5_16k = 'gpt-3.5-turbo-16k',
  GPT4 = 'gpt-4',
  GPT4_32k = 'gpt-4-32k',
  NetGPT4 = 'net-gpt-4',
  Sage = 'sage',
  NetGpt3p5 = 'net-gpt-3.5-turbo',
  ClaudeInstance = 'claude-instance',
  Claude = 'claude',
  Claude100k = 'claude-100k',
  Claude2_100k = 'claude-2-100k',
  Gpt4free = 'gpt-4-free',
  GooglePalm = 'google-palm',
  Llama_2_70b = 'llama-2-70b',
  Llama_2_13b = 'llama-2-13b',
  Llama_2_7b = 'llama-2-7b',
  Code_Llama_34b = 'code-llama-34b',
  Code_Llama_13b = 'code-llama-13b',
  Code_Llama_7b = 'code-llama-7b',
  Search = 'search',
  URL = 'url',
}

export enum Site {
  // define new model here
  You = 'you',
  Phind = 'phind',
  Forefront = 'forefront',
  Mcbbs = 'mcbbs',
  ChatDemo = 'chatdemo',
  Vita = 'vita',
  Skailar = 'skailar',
  FakeOpen = 'fakeopen',
  EasyChat = 'easychat',
  Better = 'better',
  PWeb = 'pweb',
  Bai = 'bai',
  Gra = 'gra',
  Magic = 'magic',
  Chim = 'chim',
  Ram = 'ram',
  Chur = 'chur',
  Xun = 'xun',
  VVM = 'vvm',
  Poef = 'poef',
  Claude = 'claude',
  Cursor = 'cursor',
  Auto = 'auto',
  ChatBase = 'chatbase',
  AiLs = 'ails',
  SinCode = 'sincode',
  OpenAI = 'openai',
  OneAPI = 'oneapi',
  Jasper = 'jasper',
  Pap = 'pap',
  MyShell = 'myshell',
  AcyToo = 'acytoo',
  Google = 'google',
  WWW = 'www',
  DDG = 'ddg',
}

export interface ChatRequest {
  prompt: string;
  model: ModelType;
  messages: Message[];
}

// 结构体message转换为prompt
export function messagesToPrompt(messages: Message[]): string {
  if (messages.length === 1) {
    return messages[0].content;
  }
  return (
    messages.map((item) => `${item.role}: ${item.content}`).join('\n') +
    '\n' +
    'assistant: '
  );
}

export function sliceMessagesByToken(
  messages: Message[],
  limitSize: number,
  countPrompt: boolean = false,
): Message[] {
  const size = getTokenCount(
    countPrompt
      ? messagesToPrompt(messages)
      : messages.reduce((prev, cur) => prev + cur.content, ''),
  );
  console.log(
    `${
      countPrompt ? 'prompt' : 'messages.content'
    } token count ${size} / ${limitSize}`,
  );
  if (size < limitSize) {
    return messages;
  }
  const newMessage = messages.slice(1, messages.length);
  if (newMessage.length === 0) {
    throw new ComError('message too long', ComError.Status.RequestTooLarge);
  }
  return sliceMessagesByToken(newMessage, limitSize);
}

export function sliceMessagesByLength(
  messages: Message[],
  limitSize: number,
  countPrompt: boolean = false,
): Message[] {
  const size = (
    countPrompt
      ? messagesToPrompt(messages)
      : messages.reduce((prev, cur) => prev + cur.content, '')
  ).length;
  console.log(
    `${
      countPrompt ? 'prompt' : 'messages.content'
    } length ${size} / ${limitSize}`,
  );
  if (size < limitSize) {
    return messages;
  }
  const newMessage = messages.slice(1, messages.length);
  if (newMessage.length === 0) {
    throw new ComError('message too long', ComError.Status.RequestTooLarge);
  }
  return sliceMessagesByLength(newMessage, limitSize);
}

export class Chat {
  protected options: ChatOptions | undefined;
  protected logger: winston.Logger;

  protected constructor(options?: ChatOptions) {
    this.options = options;
    this.logger = newLogger(options?.name);
  }

  public support(model: ModelType): number {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }

  public async preHandle(
    req: ChatRequest,
    options?: { token?: boolean; countPrompt?: boolean },
  ): Promise<ChatRequest> {
    const { token = false, countPrompt = true } = options || {};
    const size = this.support(req.model);
    if (!size) {
      throw new ComError(
        `not support model: ${req.model}`,
        ComError.Status.NotFound,
      );
    }
    req.messages = token
      ? sliceMessagesByToken(req.messages, size, countPrompt)
      : sliceMessagesByLength(req.messages, size, countPrompt);
    req.prompt = messagesToPrompt(req.messages);
    return req;
  }

  public async ask(req: ChatRequest): Promise<ChatResponse> {
    const stream = new EventStream();
    await this.askStream(req, stream);
    const result: ChatResponse = {
      content: '',
    };
    return new Promise((resolve) => {
      stream.read(
        (event, data) => {
          switch (event) {
            case Event.done:
              break;
            case Event.message:
              result.content += (data as MessageData).content || '';
              break;
            case Event.error:
              result.error = (data as ErrorData).error;
              break;
          }
        },
        () => {
          resolve(result);
        },
      );
    });
  }

  public async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }
}
