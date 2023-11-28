import {
  ComError,
  ErrorData,
  Event,
  EventStream,
  getTokenCount,
  MessageData,
  OpenaiEventStream,
  removeRandomChars,
} from '../utils';
import winston from 'winston';
import { newLogger } from '../utils/log';
import { ClaudeChat } from './claude';

export interface ChatOptions {
  name: string;
}

export interface ChatResponse {
  content?: string;
  role?: string;
  function_call?: { name: string; arguments: string };
  error?: string;
}

export type Message = {
  role: string;
  content: string;
};

export enum ModelType {
  GPT3p5Turbo = 'gpt-3.5-turbo',
  GPT3p5TurboInstruct = 'gpt-3.5-turbo-instruct',
  GPT3p5_16k = 'gpt-3.5-turbo-16k',
  GPT4 = 'gpt-4',
  GPT4V = 'gpt-4-v',
  GPT4All = 'gpt-4-all',
  GPT4Dalle = 'gpt-4-dalle',
  GPT4Gizmo = 'gpt-4-gizmo',
  GPT4AllSource = 'gpt-4-all-source',
  GPT4_32k = 'gpt-4-32k',
  NetGPT4 = 'net-gpt-4',
  DalleE3 = 'dalle-e-3',
  Sage = 'sage',
  NetGpt3p5 = 'net-gpt-3.5-turbo',
  ClaudeInstant = 'claude-instant',
  Claude = 'claude',
  ClaudeInstant_100k = 'claude-instant-100k',
  Claude100k = 'claude-100k',
  Claude2 = 'claude-2',
  Gpt4free = 'gpt-4-free',
  GooglePalm = 'google-palm',
  Llama_2_70b = 'llama-2-70b',
  Llama_2_13b = 'llama-2-13b',
  Llama_2_7b = 'llama-2-7b',
  Code_Llama_34b = 'code-llama-34b',
  Code_Llama_13b = 'code-llama-13b',
  Code_Llama_7b = 'code-llama-7b',
  StableDiffusion = 'stable-diffusion',
  Search = 'search',
  URL = 'url',
  ErnieBotTurbo = 'ernie-bot-turbo',
  ErnieBot = 'ernie-bot',
  Bard = 'bard',
  MetaLlama = 'meta-llama',
  Solar_0_70b = 'solar-0-70b',
  Fw_mistral_7b = 'fw-mistral-7b',
}

export enum Site {
  // define new model here
  You = 'you',
  Phind = 'phind',
  Forefront = 'forefront',
  ForefrontNet = 'forefront_net',
  Mcbbs = 'mcbbs',
  ChatDemo = 'chatdemo',
  Vita = 'vita',
  Copilot = 'copilot',
  Skailar = 'skailar',
  FakeOpen = 'fakeopen',
  EasyChat = 'easychat',
  Better = 'better',
  PWeb = 'pweb',
  Bai = 'bai',
  Gra = 'gra',
  Magic = 'magic',
  Chim = 'chim',
  Poe = 'poe',
  Ram = 'ram',
  Chur = 'chur',
  Xun = 'xun',
  VVM = 'vvm',
  Poef = 'poef',
  PoeAuto = 'poeauto',
  PoeVIP = 'poevip',
  Claude = 'claude',
  ClaudeChat = 'claudechat',
  Cursor = 'cursor',
  Auto = 'auto',
  ChatBase = 'chatbase',
  OpenPrompt = 'openprompt',
  AiLs = 'ails',
  Perplexity = 'perplexity',
  SinCode = 'sincode',
  OpenAI = 'openai',
  OneAPI = 'oneapi',
  Jasper = 'jasper',
  OpenChat = 'openchat',
  OpenChat3 = 'openchat3',
  Pap = 'pap',
  MyShell = 'myshell',
  AcyToo = 'acytoo',
  Google = 'google',
  WWW = 'www',
  Bing = 'bing',
  DDG = 'ddg',
  Vanus = 'vanus',
  Mixer = 'mixer',
  Merlin = 'merlin',
  Airops = 'airops',
  Langdock = 'langdock',
  Toyy = 'toyy',
  TakeOff = 'takeoff',
  Navit = 'navit',
  Stack = 'stack',
  TD = 'td',
  OpenChat4 = 'openchat4',
  Izea = 'izea',
  Askx = 'askx',
}

export interface ChatRequest {
  prompt: string;
  model: ModelType;
  messages: Message[];
  search?: boolean;
  max_tokens?: number;
  secret?: string;
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
  forceRemove: boolean = false,
): Message[] {
  const size = getTokenCount(
    countPrompt
      ? messagesToPrompt(messages)
      : messages.reduce((prev, cur) => prev + cur.content, ''),
  );
  console.debug(
    `${
      countPrompt ? 'prompt' : 'messages.content'
    } token count ${size} / ${limitSize}`,
  );
  if (size < limitSize) {
    return messages;
  }
  const newMessage =
    size / limitSize > 2 && messages.length > 21
      ? messages.slice(-20)
      : messages.slice(1, messages.length);
  if (newMessage.length === 0) {
    if (!forceRemove) {
      throw new ComError('message too long', ComError.Status.RequestTooLarge);
    }
    messages[0].content = removeRandomChars(
      messages[0].content,
      (size - limitSize || 1) / size,
    );
    return sliceMessagesByToken(messages, limitSize, countPrompt, forceRemove);
  }
  return sliceMessagesByToken(newMessage, limitSize, countPrompt, forceRemove);
}

export function sliceMessagesByLength(
  messages: Message[],
  limitSize: number,
  countPrompt: boolean = false,
  forceRemove: boolean = false,
): Message[] {
  const size = (
    countPrompt
      ? messagesToPrompt(messages)
      : messages.reduce((prev, cur) => prev + cur.content, '')
  ).length;
  console.debug(
    `${
      countPrompt ? 'prompt' : 'messages.content'
    } length ${size} / ${limitSize}`,
  );
  if (size < limitSize) {
    return messages;
  }
  const newMessage =
    size / limitSize > 2 && messages.length > 21
      ? messages.slice(-20)
      : messages.slice(1, messages.length);
  if (newMessage.length === 0) {
    if (!forceRemove) {
      throw new ComError('message too long', ComError.Status.RequestTooLarge);
    }
    messages[0].content = removeRandomChars(
      messages[0].content,
      (size - limitSize || 1) / size,
    );
    return sliceMessagesByLength(messages, limitSize, countPrompt, forceRemove);
  }
  return sliceMessagesByLength(newMessage, limitSize, countPrompt, forceRemove);
}

export class Chat {
  protected options?: ChatOptions;
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
    options?: {
      token?: boolean;
      countPrompt?: boolean;
      forceRemove?: boolean;
      stream?: EventStream;
    },
  ): Promise<ChatRequest> {
    const {
      token = false,
      countPrompt = true,
      forceRemove = false,
    } = options || {};
    const size = this.support(req.model);
    if (!size) {
      throw new ComError(
        `not support model: ${req.model}`,
        ComError.Status.NotFound,
      );
    }
    req.messages = token
      ? sliceMessagesByToken(req.messages, size, countPrompt, forceRemove)
      : sliceMessagesByLength(req.messages, size, countPrompt, forceRemove);
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
              data = data as MessageData;
              result.content += data.content || '';
              if (data.role) {
                result.role = data.role;
              }
              if (data.function_call) {
                if (!result.function_call) {
                  result.function_call = data.function_call;
                }
                if (data.function_call.name) {
                  result.function_call = data.function_call;
                }
                if (data.function_call.arguments) {
                  result.function_call.arguments +=
                    data.function_call.arguments;
                }
              }
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
