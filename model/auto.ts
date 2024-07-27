import {
  Chat,
  ChatOptions,
  ChatRequest,
  contentToString,
  ImageGenerationRequest,
  messagesToPrompt,
  ModelType,
  Site,
  SpeechRequest,
  TextEmbeddingRequest,
} from './base';
import {
  ComError,
  Event,
  EventStream,
  matchPattern,
  parseJSON,
  ThroughEventStream,
  TimeFormat,
} from '../utils';
import { Config, SiteCfg } from '../utils/config';
import { OpenAI } from './openai';
import { ClaudeAPI } from './claudeapi';
import moment from 'moment';
import Application, { Context } from 'koa';
import { GLM } from './glm';
import {
  CreateVideoTaskRequest,
  ImageEditRequest,
  QueryVideoTaskRequest,
  TranscriptionRequest,
} from './define';
import { SongOptions } from './suno/define';

interface AutoOptions extends ChatOptions {
  ModelMap: Map<Site, Chat>;
}

export class Auto extends Chat {
  private modelMap: Map<Site, Chat>;
  private openAIChatMap: Map<string, OpenAI> = new Map();
  private claudeAIChatMap: Map<string, ClaudeAPI> = new Map();
  private glmAIChatMap: Map<string, GLM> = new Map();

  constructor(options: AutoOptions) {
    super(options);
    this.modelMap = options.ModelMap;
  }

  getOpenAIChat = (v: SiteCfg) => {
    const key = JSON.stringify(v);
    if (!this.openAIChatMap.has(key)) {
      this.logger.info(`create openai chat: ${key}`);
      this.openAIChatMap.set(
        key,
        new OpenAI({
          api_key: v.api_key,
          base_url: v.base_url,
          name: v.label || v.site,
          proxy: v.proxy,
          model_map: v.model_map,
        }),
      );
    }
    return this.openAIChatMap.get(key) as OpenAI;
  };
  getGLMChat = (v: SiteCfg) => {
    const key = JSON.stringify(v);
    if (!this.glmAIChatMap.has(key)) {
      this.logger.info(`create openai chat: ${key}`);
      this.glmAIChatMap.set(
        key,
        new GLM({
          api_key: v.api_key,
          base_url: v.base_url,
          name: v.label || v.site,
          proxy: v.proxy,
          model_map: v.model_map,
        }),
      );
    }
    return this.glmAIChatMap.get(key) as GLM;
  };

  getClaudeAIChat = (v: SiteCfg) => {
    const key = JSON.stringify(v);
    if (!this.claudeAIChatMap.has(key)) {
      this.logger.info(`create claudeai chat: ${key}`);
      this.claudeAIChatMap.set(
        key,
        new ClaudeAPI({
          api_key: v.api_key,
          base_url: v.base_url,
          name: v.label || v.site,
          proxy: v.proxy,
          model_map: v.model_map,
        }),
      );
    }
    return this.claudeAIChatMap.get(key) as ClaudeAPI;
  };

  getRandomModel(req: {
    model: ModelType;
    prompt_tokens?: number;
    prompt_length?: number;
  }): Chat {
    const { model, prompt_tokens, prompt_length } = req;
    const list: SiteCfg[] = [];
    for (const m in Config.config.site_map) {
      const v = Config.config.site_map[m as ModelType] || [];
      // 通配符
      if (!matchPattern(m, model)) {
        continue;
      }
      for (const cfg of v) {
        if (!cfg.priority) {
          continue;
        }
        if (cfg.condition && eval(cfg.condition) !== true) {
          continue;
        }
        this.logger.debug(`auto site match ${m} ${model}`);
        list.push(cfg);
      }
    }
    if (!list) {
      throw new ComError(
        `not cfg ${model} in site_map}`,
        ComError.Status.NotFound,
      );
    }

    let sum = 0;
    for (const item of list) {
      sum += item.priority;
    }

    let rand = Math.random() * sum;
    let v: SiteCfg | undefined;
    for (let i = 0; i < list.length; i++) {
      rand -= list[i].priority;
      if (rand < 0) {
        v = list[i];
        break;
      }
    }
    if (!v) {
      throw new ComError(
        `not cfg ${model} in site_map}`,
        ComError.Status.NotFound,
      );
    }
    const label = v.label || v.site;
    this.logger.info(`${model} auto site choose site [${label}]`, {
      label,
      model,
    });
    if (v.site === Site.OpenAI) {
      return this.getOpenAIChat(v);
    }
    if (v.site === Site.Claude) {
      return this.getClaudeAIChat(v);
    }
    if (v.site === Site.GLM) {
      return this.getGLMChat(v);
    }
    return this.modelMap.get(v.site) as Chat;
  }

  async tryAskStream(
    req: ChatRequest,
    stream: EventStream,
    tried: number = 0,
  ): Promise<void> {
    const es = new ThroughEventStream(
      (event, data) => {
        switch (event) {
          case Event.error:
            this.logger.error(
              `auto ask failed(${tried}), got error event: ${JSON.stringify(
                data,
              )}`,
            );
            if (tried >= (Config.config.global.retry_max_times || 0)) {
              stream.write(event, data);
              stream.write(Event.done, { content: '' });
              stream.end();
              return;
            }
            es.destroy();
            this.tryAskStream(req, stream, tried + 1).catch((e) => {
              this.logger.error(`event error & retry failed ${e.message}`);
            });
            break;
          default:
            stream.write(event, data);
            break;
        }
      },
      () => {
        stream.end();
      },
    );
    const chat = this.getRandomModel(req);
    if (!chat) {
      es.destroy();
      throw new ComError(
        `not support model: ${req.model}`,
        ComError.Status.NotFound,
      );
    }
    try {
      if (tried === 0) {
        await chat.preHandle(req, { stream });
      }
      await chat.askStream(req, es);
    } catch (e: any) {
      this.logger.error(`auto ask failed(${tried}) ${e.message}`);
      if (tried >= (Config.config.global.retry_max_times || 0)) {
        stream.write(Event.error, { error: e.message });
        stream.write(Event.done, { content: '' });
        stream.end();
        return;
      }
      this.tryAskStream(req, stream, tried + 1).catch((e) =>
        this.logger.error(`retry failed ${e.message}`),
      );
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    return this.tryAskStream(req, stream);
  }

  support(model: ModelType): number {
    // auto站点不处理
    return Number.MAX_SAFE_INTEGER;
  }

  async preHandle(req: ChatRequest, options: any): Promise<ChatRequest> {
    if (req.search) {
      const searchStr = contentToString(
        req.messages[req.messages.length - 1].content,
      );
      const searchRes = await this.ask({
        model: ModelType.Search,
        messages: [{ role: 'user', content: searchStr }],
        prompt: searchStr,
      });
      if (!searchRes.content) {
        return req;
      }
      let searchParsed = parseJSON<
        { title: string; link: string; description: string }[]
      >(searchRes.content || '', []);
      if (searchParsed.length === 0) {
        return req;
      }
      searchParsed = searchParsed.slice(0, 5);
      if (options?.stream) {
        options.stream.write(Event.message, {
          content: `${searchParsed
            .map((v) => `- [${v.title}](${v.link})`)
            .join('\n')}\n\n`,
        });
      }
      const searchResStr = searchParsed
        .map(
          (item) =>
            `<link title='${item.title}' href='${item.link}'>${item.description}</link>`,
        )
        .join('\n');
      const urlParse = await this.ask({
        model: ModelType.URL,
        messages: [{ role: 'user', content: searchParsed[0].link }],
        prompt: searchParsed[0].link,
        max_tokens: 1000,
      });
      const urlContent = urlParse.content;
      req.messages = [
        ...req.messages.slice(0, -1),
        {
          role: 'user',
          content: `I need you to act as an intelligent assistant, refer to the search results I provided, and ignore some search content that does not relate to my question, then summarize, and answer my question in detail. \n\nCurrent Date:${moment().format(
            TimeFormat,
          )}\n\nMy question is:<question>${searchStr}</question>\n\n The search results are:\n<search>${searchResStr}</search>\n<firstsearchlink>${
            urlContent || ''
          }</firstsearchlink> \n\n The answer is as follows(The most important, the language of the answer must be the same of my question's language.):`,
        },
      ];
    }
    // auto站点不处理
    // req.prompt_tokens = countMessagesToken(req.messages);
    req.prompt_length = messagesToPrompt(req.messages).length;
    return req;
  }

  async speech(ctx: Application.Context, req: SpeechRequest): Promise<void> {
    const chat = this.getRandomModel(req);
    await chat.speech(ctx, req);
  }

  async generations(
    ctx: Application.Context,
    req: ImageGenerationRequest,
  ): Promise<void> {
    const chat = this.getRandomModel(req);
    await chat.generations(ctx, req);
  }

  async embeddings(
    ctx: Application.Context,
    req: TextEmbeddingRequest,
  ): Promise<void> {
    const chat = this.getRandomModel(req);
    await chat.embeddings(ctx, req);
  }

  public async transcriptions(ctx: Context, req: TranscriptionRequest) {
    const chat = this.getRandomModel(req);
    await chat.transcriptions(ctx, req);
  }

  public async createVideoTask(ctx: Context, req: CreateVideoTaskRequest) {
    const chat = this.getRandomModel(req);
    await chat.createVideoTask(ctx, req);
  }

  public async queryVideoTask(
    ctx: Application.Context,
    req: QueryVideoTaskRequest,
  ): Promise<void> {
    const chat = this.getRandomModel(req);
    await chat.queryVideoTask(ctx, req);
  }

  async createSong(ctx: Application.Context, req: SongOptions) {
    const chat = this.getRandomModel({ model: req.mv });
    await chat.createSong(ctx, req);
  }

  async feedSong(
    ctx: Application.Context,
    req: { ids: string[]; server_id: string },
  ) {
    const chat = this.getRandomModel({ model: ModelType.ChirpV3_0 });
    await chat.feedSong(ctx, req);
  }

  async ImagesEdits(
    ctx: Application.Context,
    req: ImageEditRequest,
  ): Promise<void> {
    const chat = this.getRandomModel({ model: req.model || ModelType.DallE2 });
    await chat.ImagesEdits(ctx, req);
  }
}
