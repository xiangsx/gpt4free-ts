import { Chat, ChatRequest, ModelType, Site } from '../base';
import {
  Event,
  EventStream,
  extractJSON,
  MessageData,
  retryFunc,
  ThroughEventStream,
} from '../../utils';
import {
  Account,
  ChatReq,
  ChatReqJoi,
  ExpressReq,
  ExpressReqJoi,
  PromptRes,
  SubtitleReq,
  SubtitleReqJoi,
  SummaryReq,
  SummaryReqJoi,
  VisionReq,
  VisionReqJoi,
} from './define';
import { Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import { v4 } from 'uuid';
import { Child } from './child';
import Router from 'koa-router';
import { checkBody, checkQuery } from '../../utils/middleware';
import { chatModel } from '../index';
import { BibiPrompt } from './prompt';

export class Bibi extends Chat {
  pool = new Pool<Account, Child>(
    this.options?.name || 'claude-api',
    () => Config.config.bibi?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.api_key) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.bibi?.serial || 1,
      needDel: (info) => !info.api_key,
      preHandleAllInfos: async (allInfos) => {
        const oldSet = new Set(allInfos.map((v) => v.api_key));
        for (const v of Config.config.bibi?.apikey_list || []) {
          if (!oldSet.has(v)) {
            allInfos.push({
              id: v4(),
              api_key: v,
            } as Account);
          }
        }
        return allInfos;
      },
    },
  );

  support(model: ModelType): number {
    switch (model) {
      case ModelType.UrlAnalysis:
        return 32000;
      default:
        return 0;
    }
  }

  async summaryStream(req: PromptRes, stream: EventStream) {
    const child = await this.pool.pop();
    const sReq: SummaryReq = {
      url: req.url,
    };
    if (req.customPrompt) {
      sReq.promptConfig = {
        customPrompt: req.customPrompt,
        isRefresh: true,
      };
    }
    stream.write(Event.message, { content: '\n\n> 正在分析中，请稍候...' });
    const res = await child.summary({
      url: req.url,
    });
    stream.write(Event.message, {
      content: `\n\n\`\`\`\n${JSON.stringify(res, null, 4)}\n\`\`\``,
    });
    stream.write(Event.message, {
      content: `\n\n ${res.summary}`,
    });
  }

  async subtitleStream(req: SubtitleReq, stream: EventStream) {
    const child = await this.pool.pop();
    const sReq: SubtitleReq = { url: req.url };
    stream.write(Event.message, { content: '\n\n> 正在分析中，请稍候...' });
    const res = await child.subtitle(sReq);
    stream.write(Event.message, {
      content: `\n\n\`\`\`\n${JSON.stringify(res, null, 4)}\n\`\`\``,
    });
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    const auto = chatModel.get(Site.Auto);
    let old = '';
    const pt = new ThroughEventStream(
      (event, data) => {
        stream.write(event, data);
        if ((data as MessageData).content) {
          old += (data as MessageData).content;
        }
      },
      async () => {
        try {
          await retryFunc(
            async () => {
              stream.write(Event.message, { content: '\n\n' });
              const action = extractJSON<PromptRes>(old);
              if (!action) {
                stream.write(Event.message, {
                  content: 'Generate action failed',
                });
                stream.write(Event.done, { content: '' });
                stream.end();
                return;
              }
              switch (action.type) {
                case 'subtitle':
                  await this.subtitleStream(action, stream);
                  break;
                case 'summary':
                  await this.summaryStream(action, stream);
                  break;
                default:
                  break;
              }
            },
            3,
            { label: 'bibi action', delay: 100 },
          );
          stream.write(Event.done, { content: '' });
          stream.end();
        } catch (e: any) {
          this.logger.error(e.message);
          stream.write(Event.message, { content: `生成失败: ${e.message}` });
          stream.write(Event.done, { content: '' });
          stream.end();
        }
      },
    );
    req.messages = [{ role: 'system', content: BibiPrompt }, ...req.messages];
    await auto?.askStream(
      {
        ...req,
        model: Config.config.bibi?.model || ModelType.GPT4_32k,
      } as ChatRequest,
      pt,
    );
  }

  dynamicRouter(router: Router): boolean {
    router.post('/summary', checkBody(SummaryReqJoi), async (ctx) => {
      const child = await this.pool.pop();
      const res = await child.summary(ctx.request.body as SummaryReq);
      ctx.body = res;
    });
    router.get('/subtitle', checkQuery(SubtitleReqJoi), async (ctx) => {
      const child = await this.pool.pop();
      const res = await child.subtitle(ctx.query as SubtitleReq);
      ctx.body = res;
    });
    router.post('/chat', checkBody(ChatReqJoi), async (ctx) => {
      const child = await this.pool.pop();
      const res = await child.chat(ctx.request.body as ChatReq);
      ctx.body = res;
    });
    router.post('/express', checkBody(ExpressReqJoi), async (ctx) => {
      const child = await this.pool.pop();
      const res = await child.express(ctx.request.body as ExpressReq);
      ctx.body = res;
    });
    router.post('/vision', checkBody(VisionReqJoi), async (ctx) => {
      const child = await this.pool.pop();
      const res = await child.vision(ctx.request.body as VisionReq);
      ctx.body = res;
    });
    return true;
  }
}
