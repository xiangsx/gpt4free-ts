import Koa, { Context, Middleware, Next } from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import { ChatModelFactory } from './model';
import dotenv from 'dotenv';
import {
  ChatRequest,
  ChatResponse,
  Message,
  ModelType,
  PromptToString,
  Site,
} from './model/base';
import {
  Event,
  EventStream,
  getTokenSize,
  OpenaiEventStream,
  randomStr,
  replaceConsoleWithWinston,
  ThroughEventStream,
} from './utils';
import moment from 'moment';
import { Config } from './utils/config';
import { resolve } from 'dns';

process.setMaxListeners(100); // 将限制提高到20个

dotenv.config();
replaceConsoleWithWinston();
Config.load();
Config.watchFile();

const app = new Koa();
app.use(cors());
const router = new Router();
const errorHandler = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err: any) {
    console.error(err);
    ctx.body = JSON.stringify(err);
    ctx.res.end();
  }
};
app.use(errorHandler);
app.use(bodyParser({ jsonLimit: '10mb' }));
const chatModel = new ChatModelFactory();

interface AskReq extends ChatRequest {
  site: Site;
}

interface AskRes extends ChatResponse {}

const AskHandle: Middleware = async (ctx) => {
  const {
    prompt,
    model = ModelType.GPT3p5Turbo,
    site = Site.You,
  } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as AskReq;
  if (!prompt) {
    ctx.body = { error: `need prompt in query` } as AskRes;
    ctx.status = 500;
    return;
  }
  const chat = chatModel.get(site);
  if (!chat) {
    ctx.body = { error: `not support site: ${site} ` } as AskRes;
    ctx.status = 500;
    return;
  }
  const tokenLimit = chat.support(model);
  if (!tokenLimit) {
    ctx.body = { error: `${site} not support model ${model}` } as AskRes;
    ctx.status = 500;
    return;
  }
  const [content, messages] = PromptToString(prompt, tokenLimit);
  const data = await chat.ask({ prompt: content, messages, model });
  if (data && data.error) {
    ctx.status = 500;
  }
  ctx.body = data;
};

const AskStreamHandle: (ESType: new () => EventStream) => Middleware =
  (ESType) => async (ctx) => {
    const {
      prompt,
      model = ModelType.GPT3p5Turbo,
      site = Site.You,
    } = {
      ...(ctx.query as any),
      ...(ctx.request.body as any),
      ...(ctx.params as any),
    } as AskReq;
    if (!prompt) {
      ctx.body = { error: 'need prompt in query' };
      ctx.status = 500;
      return;
    }
    const chat = chatModel.get(site);
    if (!chat) {
      ctx.body = { error: `not support site: ${site} ` };
      ctx.status = 500;
      return;
    }
    const tokenLimit = chat.support(model);
    if (!tokenLimit) {
      ctx.body = { error: `${site} not support model ${model}` };
      ctx.status = 500;
      return;
    }
    let stream = new ESType();
    let ok = true;
    const timeout = setTimeout(() => {
      ctx.body = { error: 'timeout' };
      ctx.status = 500;
    }, 120 * 1000);
    return (() =>
      new Promise<void>(async (resolve) => {
        const es = new ThroughEventStream(
          (event, data) => {
            switch (event) {
              case Event.error:
                ok = false;
                ctx.body = data;
                ctx.status = 500;
                resolve();
                break;
              default:
                clearTimeout(timeout);
                if (!ok) {
                  break;
                }
                if (!ctx.body) {
                  ctx.set({
                    'Content-Type': 'text/event-stream;charset=utf-8',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                  });
                  ctx.body = stream.stream();
                }
                resolve();
                stream.write(event, data);
                break;
            }
          },
          () => {
            if (!ok) {
              return;
            }
            stream.end();
          },
        );
        const [content, messages] = PromptToString(prompt, tokenLimit);
        await chat.askStream({ prompt: content, messages, model }, es);
      }))();
  };

interface OpenAIReq {
  site: Site;
  stream: boolean;
  model: ModelType;
  messages: Message[];
}

interface Support {
  site: string;
  models: string[];
}

router.get('/supports', (ctx) => {
  const result: Support[] = [];
  for (const key in Site) {
    //@ts-ignore
    const site = Site[key];
    //@ts-ignore
    const chat = chatModel.get(site);
    const support: Support = { site: site, models: [] };
    for (const mKey in ModelType) {
      //@ts-ignore
      const model = ModelType[mKey];
      //@ts-ignore
      if (chat?.support(model)) {
        support.models.push(model);
      }
    }
    result.push(support);
  }
  ctx.body = result;
});
router.get('/ask', AskHandle);
router.post('/ask', AskHandle);
router.get('/ask/stream', AskStreamHandle(EventStream));
router.post('/ask/stream', AskStreamHandle(EventStream));
const openAIHandle: Middleware = async (ctx, next) => {
  const { stream, messages } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as OpenAIReq;
  (ctx.request.body as any).prompt = JSON.stringify(
    (ctx.request.body as any).messages,
  );
  if (stream) {
    await AskStreamHandle(OpenaiEventStream)(ctx, next);
    return;
  }
  await AskHandle(ctx, next);
  let reqLen = 0;
  for (const v of messages) {
    reqLen += getTokenSize(v.content);
  }
  ctx.body = {
    id: `chatcmpl-${randomStr()}`,
    object: 'chat.completion',
    created: moment().unix(),
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: ctx.body.content || ctx.body.error,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: reqLen,
      completion_tokens: getTokenSize(ctx.body.content || ''),
      total_tokens: reqLen + getTokenSize(ctx.body.content || ''),
    },
  };
};

router.post('/v1/chat/completions', openAIHandle);
router.post('/:site/v1/chat/completions', openAIHandle);

app.use(router.routes());

(async () => {
  const port = +(process.env.PORT || 3000);
  const server = app.listen(+(process.env.PORT || 3000), () => {
    console.log(`Now listening: 127.0.0.1:${port}`);
  });
  process.on('SIGINT', () => {
    server.close(() => {
      process.exit(0);
    });
  });
  process.on('uncaughtException', (e) => {
    console.error('uncaughtException', e);
    process.exit(1);
  });
})();
