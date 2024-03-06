import {
  ComError,
  ErrorData,
  Event,
  EventStream,
  extractHttpFileURLs,
  getTokenCount,
  MessageData,
  OpenaiEventStream,
  removeRandomChars,
} from '../utils';
import winston from 'winston';
import { newLogger } from '../utils/log';
import { ClaudeChat } from './claude';
import exp from 'constants';
import { OpenSess } from './opensess';
import { Hypotenuse } from './hypotenuse';
import { Midjourney } from './midjourney';
import { Context } from 'koa';
import {
  TranscriptionRequest,
  CreateVideoTaskRequest,
  QueryVideoTaskRequest,
} from './define';

export interface ChatOptions {
  name: string;
}

export interface ChatResponse {
  content?: string;
  role?: string;
  function_call?: { name: string; arguments: string };
  error?: string;
}

export type MessageContent =
  | string
  | (
      | {
          type: 'image_url' | 'text';
          text?: string;
          image_url?:
            | string
            | {
                url: string;
                detail?: 'auto' | 'high' | 'low';
              };
        }
      | string
    )[];

export type Message = {
  role: string;
  content: MessageContent;
};

export function getImagesFromContent(content: MessageContent): string[] {
  if (typeof content === 'string') {
    return [...extractHttpFileURLs(content)];
  }
  return content.reduce((prev: string[], cur) => {
    if (typeof cur === 'string') {
      return [...prev, ...extractHttpFileURLs(cur)];
    }
    if (cur.type === 'image_url') {
      if (typeof cur.image_url === 'string') {
        return [...prev, cur.image_url];
      }
      return [...prev, cur.image_url!.url];
    }
    return [...prev, ...extractHttpFileURLs(cur.text || '')];
  }, []);
}

export enum ModelType {
  GPT3p5Turbo = 'gpt-3.5-turbo',
  Assistant = 'assistant',
  GPT3p5TurboInstruct = 'gpt-3.5-turbo-instruct',
  GPT3p5_16k = 'gpt-3.5-turbo-16k',
  GPT4 = 'gpt-4',
  GPT4V = 'gpt-4-v',
  GPT4All = 'gpt-4-all',
  GPT4Dalle = 'gpt-4-dalle',
  GPT4Gizmo = 'gpt-4-gizmo',
  GPT4AllSource = 'gpt-4-all-source',
  GPT4VisionPreview = 'gpt-4-vision-preview',
  GPT41106Preview = 'gpt-4-1106-preview',
  GPT40125Preview = 'gpt-4-0125-preview',
  GPT4TurboPreview = 'gpt-4-turbo-preview',
  GPT4_32k = 'gpt-4-32k',
  NetGPT4 = 'net-gpt-4',
  DallE3 = 'dall-e-3',
  DallE2 = 'dall-e-2',
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
  Code_Llama_70b_fw = 'code-llama-34b-fw',
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
  PlaygroundV2 = 'playground-v2',
  GeminiPro = 'gemini-pro',
  GeminiProVision = 'gemini-pro-vision',
  Qwen72bChat = 'qwen-72b',
  Mixtral8x7BChat = 'mixtral-8x7b',
  MistralMedium = 'mistral-medium',
  Claude3Opus20240229 = 'claude-3-opus-20240229',
  Claude3Sonnet20240229 = 'claude-3-sonnet-20240229',
  Claude3Sonnet = 'claude-3-sonnet',
  Claude3Opus = 'claude-3-opus',
  Claude3Sonnet200k = 'claude-3-sonnet-200k',
  Claude3Opus200k = 'claude-3-opus-200k',
  GetGizmoInfo = 'get-gizmo-info',
  SearchGPTS = 'search-gpts',
  SearchGPTSChat = 'search-gpts-chat',
  MJChat = 'mj-chat',
  DomoChatGen = 'domo-chat-gen',
  DomoChatAnimate = 'domo-chat-animate',
  Gemma7bFW = 'gemma-7b-fw',
  TTS1 = 'tts-1',
  TTS1HD = 'tts-1-hd',
  Bing = 'bing',
  Whisper1 = 'whisper-1',
  PikaVideo = 'pika-video',
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
  GLM = 'glm',
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
  OpenSess = 'opensess',
  Hypotenuse = 'hypotenuse',
  Gemini = 'gemini',
  AIRoom = 'airoom',
  GPTGOD = 'gptgod',
  Arkose = 'arkose',
  Midjourney = 'midjourney',
  FreeGPT4 = 'freegpt4',
  Domo = 'domo',
  Pika = 'pika',
  BingCopilot = 'bingcopilot',
  ClaudeAuto = 'claudeauto',
}

export interface ChatRequest {
  prompt: string;
  model: ModelType;
  messages: Message[];
  search?: boolean;
  max_tokens?: number;
  secret?: string;
  images?: { width: number; height: number; url?: string }[];
  prompt_tokens?: number;
  response_format?: {
    type: 'json_object' | 'text';
  };
}

export interface SpeechRequest {
  model: ModelType;
  input: string;
  voice: string;
  secret?: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac';
  speed?: number;
}

export interface TextEmbeddingRequest {
  /**
   * The input text to embed, which can be a single string or an array of strings or tokens.
   * For multiple inputs in a single request, an array of strings or array of token arrays can be used.
   * The input size is limited, and the maximum size for certain models (e.g., text-embedding-ada-002)
   * is 8192 tokens. The input cannot be empty, and any array must have 2048 dimensions or less.
   */
  input: string | string[] | Array<Array<string | number>>;

  /**
   * The unique identifier for the model to be used for embedding.
   * Use the List models API to fetch all available models or refer to the Model overview for descriptions.
   */
  model: ModelType;

  /**
   * The format for the returned embeddings, which can either be a float or base64 encoded string.
   * This parameter is optional and defaults to 'float' if not specified.
   */
  encoding_format?: 'float' | 'base64';

  /**
   * The number of dimensions for the output embeddings.
   * This is an optional parameter and is only supported in 'text-embedding-3' and later models.
   */
  dimensions?: number;

  /**
   * A unique string that identifies the end-user.
   * This helps OpenAI to monitor and detect potential misuse of the service.
   * This parameter is optional.
   */
  user?: string;
}

export interface ImageGenerationRequest {
  // 'prompt' is a required field and it's a string.
  prompt: string;
  // 'model' is an optional field that defaults to a specific model version.
  model: Partial<ModelType>;
  // 'n' is an optional field that determines the number of images to generate.
  n?: number;
  // 'quality' defines the quality of the image and has specific options.
  quality?: 'standard' | 'hd';
  // 'response_format' indicates the format in which the images are returned.
  response_format?: 'url' | 'b64_json';
  // 'size' is an optional field that specifies the size of the generated images.
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  // 'style' defines the style of the generated images.
  style?: 'vivid' | 'natural';
  // 'user' is an optional string that represents a unique identifier for the user.
  user?: string;
}

export function contentToString(content: MessageContent): string {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  return content.reduce((prev: string, cur) => {
    if (typeof cur === 'string') {
      return prev + cur;
    }
    if (cur.type === 'image_url') {
      return prev;
    }
    return prev + (cur?.text || '');
  }, '');
}

// 结构体message转换为prompt
export function messagesToPrompt(messages: Message[]): string {
  if (messages.length === 1) {
    return contentToString(messages[0].content);
  }
  return (
    messages
      .map((item) => `${item.role}: ${contentToString(item.content)}`)
      .join('\n') +
    '\n' +
    'assistant: '
  );
}

export function randomRemoveContentChars(
  content: MessageContent,
  percentage: number,
) {
  if (typeof content === 'string') {
    return removeRandomChars(content, percentage);
  }
  return content.map((item) => {
    if (typeof item === 'string') {
      return removeRandomChars(item, percentage);
    }
    if (item.type === 'image_url') {
      return item;
    }
    return {
      ...item,
      text: removeRandomChars(item.text || '', percentage),
    };
  });
}

export function countMessagesToken(messages: Message[]): number {
  let token = 0;
  for (const v of messages) {
    if (typeof v.content === 'string') {
      token += getTokenCount(v.content);
      continue;
    }
    for (const item of v.content) {
      if (typeof item === 'string') {
        token += getTokenCount(item);
        continue;
      }
      if (item.type === 'text') {
        token += getTokenCount(item.text || '');
        continue;
      }
      if (item.type === 'image_url') {
        token += 85;
        continue;
      }
    }
  }
  return token;
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
    messages[0].content = randomRemoveContentChars(
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
    messages[0].content = randomRemoveContentChars(
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
    if (size !== Number.MAX_SAFE_INTEGER) {
      req.messages = token
        ? sliceMessagesByToken(req.messages, size, countPrompt, forceRemove)
        : sliceMessagesByLength(req.messages, size, countPrompt, forceRemove);
    }
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

  public async speech(ctx: Context, req: SpeechRequest) {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }

  public async generations(ctx: Context, req: ImageGenerationRequest) {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }

  public async embeddings(ctx: Context, req: TextEmbeddingRequest) {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }

  public async transcriptions(ctx: Context, req: TranscriptionRequest) {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }

  public async createVideoTask(ctx: Context, req: CreateVideoTaskRequest) {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }

  public async queryVideoTask(ctx: Context, req: QueryVideoTaskRequest) {
    throw new ComError('not implement', ComError.Status.InternalServerError);
  }
}
