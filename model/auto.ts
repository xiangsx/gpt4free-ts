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

const MaxRetryTimes = 5;

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

  ask(req: ChatRequest): Promise<ChatResponse> {
    return new Promise(async (resolve) => {
      const result: ChatResponse = {
        content: '',
      };
      const et = new ThroughEventStream(
        (event, data) => {
          switch (event) {
            case 'message':
              result.content += (data as MessageData).content;
              break;
            case 'done':
              result.content += (data as DoneData).content;
              break;
            case 'error':
              result.error = (data as ErrorData).error;
              break;
            default:
              this.logger.error(data);
              break;
          }
        },
        () => {
          resolve(result);
        },
      );
      const res = await this.askStream(req, et);
    });
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
    return await this.getRandomModel(req.model).askStream(req, es);
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    return this.tryAskStream(req, stream);
  }

  support(model: ModelType): number {
    switch (model) {
      case ModelType.GPT4:
        return 6000;
      case ModelType.GPT3p5Turbo:
        return 3000;
      case ModelType.GPT3p5_16k:
        return 12000;
      case ModelType.GPT4_32k:
        return 24000;
      case ModelType.Claude2_100k:
        return 80000;
      default:
        return 0;
    }
  }
}
