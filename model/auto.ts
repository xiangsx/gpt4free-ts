import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
  Site,
} from './base';
import {
  ComError,
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  ThroughEventStream,
} from '../utils';
import { Config, SiteCfg } from '../utils/config';
import { OpenAI } from './openai';

interface AutoOptions extends ChatOptions {
  ModelMap: Map<Site, Chat>;
}

const MaxRetryTimes = +(process.env.AUTO_RETRY_TIMES || 2);

export class Auto extends Chat {
  private modelMap: Map<Site, Chat>;

  constructor(options: AutoOptions) {
    super(options);
    this.modelMap = options.ModelMap;
  }

  getRandomModel(model: ModelType): Chat {
    const list = Config.config.site_map[model];
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
      }
    }
    if (!v) {
      throw new ComError(
        `not cfg ${model} in site_map}`,
        ComError.Status.NotFound,
      );
    }

    this.logger.info(`auto site choose site [${v.label || v.site}]`, {
      label: v.label,
    });
    if (v.site === Site.OpenAI) {
      return new OpenAI({
        api_key: v.api_key,
        base_url: v.base_url,
        name: v.label || v.site,
        proxy: v.proxy,
      });
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
            if (tried >= MaxRetryTimes) {
              stream.write(event, data);
              return;
            }
            es.destroy();
            this.logger.error(`auto ask failed, change site!`);
            this.tryAskStream(req, stream, tried + 1);
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
    const chat = this.getRandomModel(req.model);
    await chat.preHandle(req);
    return await chat.askStream(req, es).catch((err) => {
      es.destroy();
      throw err;
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    return this.tryAskStream(req, stream);
  }

  support(model: ModelType): number {
    // auto站点不处理
    return Number.MAX_SAFE_INTEGER;
  }

  async preHandle(req: ChatRequest): Promise<ChatRequest> {
    // auto站点不处理
    return req;
  }
}
