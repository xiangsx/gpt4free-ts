import Koa, { Context, Middleware, Next } from 'koa';
import {
  ChatRequest,
  ChatResponse,
  Message,
  ModelType,
  Site,
} from './model/base';
import {
  ClaudeEventStream,
  ComError,
  Event,
  EventStream,
  getTokenCount,
  OpenaiEventStream,
  parseJSON,
  randomStr,
  ThroughEventStream,
} from './utils';
import { ChatModelFactory } from './model';
import moment from 'moment/moment';
import cors from '@koa/cors';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';

const supportsHandler = async (ctx: Context) => {
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
};

const errorHandler = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err: any) {
    console.error(
      `req: ${JSON.stringify({
        ...(ctx.query as any),
        ...(ctx.request.body as any),
        ...(ctx.params as any),
      })}, error handle: `,
      err,
    );
    ctx.body = { error: { message: err.message } };
    ctx.status = err.status || ComError.Status.InternalServerError;
  }
};

const chatModel = new ChatModelFactory();

interface AskReq extends ChatRequest {
  site: Site;
}

interface AskRes extends ChatResponse {}

async function checkApiKey(ctx: Context, next: Next) {
  let secret = '';
  const authorStr =
    ctx.request.headers.authorization || ctx.request.headers['x-api-key'];
  secret = ((authorStr as string) || '').replace(/Bearer /, '');
  ctx.query = { ...ctx.query, secret };
  if (!process.env.API_KEY) {
    await next();
    return;
  }
  if (secret !== process.env.API_KEY) {
    throw new ComError('invalid api key', 401);
  }
  await next();
}

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
  req.messages.push({ role: 'assistant', content: data.content || '' });
  console.debug(req.messages);
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
    let stream = new ESType();
    stream.setModel(req.model);
    req = await chat.preHandle(req, { stream });
    let ok = true;
    const timeout = setTimeout(() => {
      stream.write(Event.error, { error: 'timeout' });
      stream.write(Event.done, { content: '' });
      stream.end();
    }, 120 * 1000);
    const input = req.messages;
    let output = '';
    return (() =>
      new Promise<void>(async (resolve, reject) => {
        try {
          const es = new ThroughEventStream(
            (event, data) => {
              switch (event) {
                case Event.error:
                  clearTimeout(timeout);
                  if (data instanceof ComError) {
                    reject(data);
                    return;
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
                  output += (data as any).content || '';
                  break;
              }
            },
            () => {
              if (!ok) {
                return;
              }
              input.push({ role: 'assistant', content: output });
              console.debug(input);
              stream.end();
            },
          );
          await chat.askStream(req, es).catch((err) => {
            clearTimeout(timeout);
            es.destroy();
            reject(err);
          });
        } catch (e) {
          reject(e);
        }
      }))();
  };

interface OpenAIReq {
  site: Site;
  stream: boolean;
  model: ModelType;
  messages: Message[];
}

interface ClaudeReq {
  site: Site;
  stream: boolean;
  model: ModelType;
  prompt: string;
}

interface Support {
  site: string;
  models: string[];
}

const openAIHandle: Middleware = async (ctx, next) => {
  const { stream, messages, model } = {
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
  let reqLen = getTokenCount(
    messages.reduce((prev, cur) => prev + cur.content, ''),
  );
  ctx.body = {
    id: 'chatcmpl-' + '89D' + randomStr(26),
    object: 'chat.completion',
    created: moment().unix(),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          ...ctx.body,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: reqLen,
      completion_tokens: getTokenCount(ctx.body.content || ''),
      total_tokens: reqLen + getTokenCount(ctx.body.content || ''),
    },
  };
};
const claudeHandle: Middleware = async (ctx, next) => {
  const { stream, model } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as ClaudeReq;
  if (stream) {
    await AskStreamHandle(ClaudeEventStream)(ctx, next);
    return;
  }
  await AskHandle(ctx, next);
  ctx.body = {
    completion: ctx.body.content,
    stop_reason: 'stop_sequence',
    model: model,
    stop: '\n\nHuman:',
    log_id: randomStr(64).toLowerCase(),
  };
};

export const registerApp = () => {
  const app = new Koa();
  app.use(cors());
  const router = new Router();
  app.use(errorHandler);
  app.use(bodyParser({ jsonLimit: '10mb' }));
  app.use(checkApiKey);
  router.get('/supports', supportsHandler);
  router.get('/ask', AskHandle);
  router.post('/ask', AskHandle);
  router.get('/ask/stream', AskStreamHandle(EventStream));
  router.post('/ask/stream', AskStreamHandle(EventStream));
  router.post('/v1/chat/completions', openAIHandle);
  router.post('/:site/v1/chat/completions', openAIHandle);
  router.post('/v1/complete', claudeHandle);
  router.post('/:site/v1/complete', claudeHandle);

  app.use(router.routes());
  const port = +(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`Now listening: 127.0.0.1:${port}`);
  });
  console.log(`Worker ${process.pid} started`);
};
