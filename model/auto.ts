import {
  Chat,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  ModelType,
  Site,
} from './base';
import {
  DoneData,
  ErrorData,
  Event,
  EventStream,
  MessageData,
  ThroughEventStream,
} from '../utils';
import { Config } from '../utils/config';

interface AutoOptions extends ChatOptions {
  ModelMap: Map<Site, Chat>;
}

function randomPick(
  list: {
    site: Site;
    priority: number;
  }[],
): Site {
  let sum = 0;
  for (const item of list) {
    sum += item.priority;
  }

  let rand = Math.random() * sum;
  for (let i = 0; i < list.length; i++) {
    rand -= list[i].priority;
    if (rand < 0) {
      return list[i].site;
    }
  }

  return Site.Claude; // 如果没有元素，返回null
}

const MaxRetryTimes = +(process.env.AUTO_RETRY_TIMES || 2);

export class Auto extends Chat {
  private modelMap: Map<Site, Chat>;

  constructor(options: AutoOptions) {
    super(options);
    this.modelMap = options.ModelMap;
  }

  getRandomModel(model: ModelType): Chat {
    const site = randomPick(Config.config.site_map[model] || []);
    this.logger.info(`auto site choose site ${site}`);
    return this.modelMap.get(site) as Chat;
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
