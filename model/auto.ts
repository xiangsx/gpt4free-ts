import { Chat, ChatOptions, ChatRequest, ModelType, Site } from './base';
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

interface AutoOptions extends ChatOptions {
  ModelMap: Map<Site, Chat>;
}

const MaxRetryTimes = +(process.env.AUTO_RETRY_TIMES || 0);

export class Auto extends Chat {
  private modelMap: Map<Site, Chat>;

  constructor(options: AutoOptions) {
    super(options);
    this.modelMap = options.ModelMap;
  }

  getRandomModel(model: ModelType): Chat {
    const list: SiteCfg[] = [];
    for (const m in Config.config.site_map) {
      const v = Config.config.site_map[m as ModelType] || [];
      // 通配符
      if (matchPattern(m, model)) {
        this.logger.debug(`auto site match ${m} ${model}`);
        list.push(...v);
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

    this.logger.info(`auto site choose site [${v.label || v.site}]`, {
      label: v.label,
    });
    if (v.site === Site.OpenAI) {
      return new OpenAI({
        api_key: v.api_key,
        base_url: v.base_url,
        name: v.label || v.site,
        proxy: v.proxy,
        model_map: v.model_map,
      });
    }
    if (v.site === Site.Claude) {
      return new ClaudeAPI({
        api_key: v.api_key,
        base_url: v.base_url,
        name: v.label || v.site,
        proxy: v.proxy,
        model_map: v.model_map,
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
    await chat.preHandle(req, { stream });
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

  async preHandle(req: ChatRequest, options: any): Promise<ChatRequest> {
    if (req.search) {
      const searchStr = req.messages[req.messages.length - 1].content;
      const searchRes = await this.ask({
        model: ModelType.Search,
        messages: [{ role: 'user', content: searchStr }],
        prompt: searchStr,
      });
      if (!searchRes.content) {
        return req;
      }
      let searchParsed = parseJSON<any[]>(searchRes.content || '', []);
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
        .map((item) => item.description)
        .join('\n');
      const urlParse = await this.ask({
        model: ModelType.URL,
        messages: [{ role: 'user', content: searchParsed[0].link }],
        prompt: searchParsed[0].link,
        max_tokens: 1000,
      });
      const urlContent = urlParse.content;
      if (!urlContent) {
        return req;
      }
      req.messages = [
        ...req.messages.slice(0, -1),
        {
          role: 'user',
          content: `我需要你作为一个智能助手，参考我给的搜索结果并且忽略一些和我问题不想干的搜索内容，总结一下，详细地回答我的问题\n\nCurrent Date:${moment().format(
            TimeFormat,
          )}\n\n我的问题是:${searchStr}\n\n 搜索结果是:${searchResStr}\n${urlContent} \n\n 回答如下：`,
        },
      ];
    }
    // auto站点不处理
    return req;
  }
}
