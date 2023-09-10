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
  Site,
} from './model/base';
import {
  ComError,
  Event,
  EventStream,
  getTokenSize,
  OpenaiEventStream,
  parseJSON,
  randomStr,
  ThroughEventStream,
} from './utils';
import moment from 'moment';
import { Config } from './utils/config';
import { initLog } from './utils/log';

process.setMaxListeners(100); // 将限制提高到20个

dotenv.config();
initLog();
Config.load();
Config.watchFile();

const app = new Koa();
app.use(cors());
const router = new Router();
const errorHandler = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err: any) {
    console.error('error handle:', err);
    ctx.body = { error: { message: err.message } };
    ctx.status = err.status || ComError.Status.InternalServerError;
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
    ...rest
  } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as AskReq;
  if (!prompt) {
    throw new ComError(`need prompt in query`, ComError.Status.BadRequest);
  }
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  let req: ChatRequest = {
    ...rest,
    prompt,
    messages: parseJSON<Message[]>(prompt, [{ role: 'user', content: prompt }]),
    model,
  };
  if (typeof req.messages !== 'object') {
    // 数值类型parseJSON后为number
    req.messages = [{ role: 'user', content: prompt }];
  }
  req = await chat.preHandle(req);
  const data = await chat.ask(req);
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
      ...rest
    } = {
      ...(ctx.query as any),
      ...(ctx.request.body as any),
      ...(ctx.params as any),
    } as AskReq;
    if (!prompt) {
      throw new ComError(`need prompt in query`, ComError.Status.BadRequest);
    }
    const chat = chatModel.get(site);
    if (!chat) {
      throw new ComError(
        `not support site: ${site} `,
        ComError.Status.NotFound,
      );
    }
    let req: ChatRequest = {
      ...rest,
      prompt,
      messages: parseJSON<Message[]>(prompt, [
        { role: 'user', content: prompt },
      ]),
      model,
    };
    if (typeof req.messages !== 'object') {
      req.messages = [{ role: 'user', content: prompt }];
    }
    req = await chat.preHandle(req);
    let stream = new ESType();
    let ok = true;
    const timeout = setTimeout(() => {
      stream.write(Event.error, { error: 'timeout' });
      stream.write(Event.done, { content: '' });
      stream.end();
    }, 120 * 1000);
    return (() =>
      new Promise<void>(async (resolve, reject) => {
        const es = new ThroughEventStream(
          (event, data) => {
            switch (event) {
              case Event.error:
                clearTimeout(timeout);
                if (data instanceof ComError) {
                  reject(data);
                }
                ok = false;
                reject(
                  new ComError(
                    (data as any)?.error || 'unknown error',
                    (data as any)?.status ||
                      ComError.Status.InternalServerError,
                  ),
                );
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
        await chat.askStream(req, es).catch((err) => {
          clearTimeout(timeout);
          es.destroy();
          reject(err);
        });
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
