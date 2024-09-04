import Koa, { Context, Middleware, Next } from 'koa';
import {
  ChatRequest,
  ChatResponse,
  countMessagesToken,
  Message,
  ModelType,
  Site,
} from './model/base';
import {
  checkSensitiveWords,
  ClaudeEventStream,
  ComError,
  Event,
  EventStream,
  filterSensitiveWords,
  genPowToken,
  getTokenCount,
  OpenaiEventStream,
  parseJSON,
  randomStr,
  sleep,
  ThroughEventStream,
} from './utils';
import moment from 'moment/moment';
import cors from '@koa/cors';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import { chatModel } from './model';
import { SaveMessagesToLogstash, TraceLogger } from './utils/log';
import apm from 'elastic-apm-node';
import Busboy from 'busboy';
import { PassThrough, Stream } from 'stream';
import FormData from 'form-data';
import fs from 'fs';
import { v4 } from 'uuid';
import { Config } from './utils/config';
import { AwsLambda } from 'elastic-apm-node/types/aws-lambda';
import { checkBody } from './utils/middleware';
import Joi from 'joi';

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

const powHandler = async (ctx: Context) => {
  const body: any = ctx.request.body;
  const { config, prefix, seed, diff } = body;
  ctx.body = genPowToken(config, prefix, seed, diff);
};

const errorHandler = async (ctx: Context, next: Next) => {
  try {
    ctx.logger = new TraceLogger();
    await next();
  } catch (err: any) {
    if (err.response?.data) {
      ctx.logger?.info(`err handle:${JSON.stringify(err.response.data)}`, {
        trace_label: 'error',
        ...(ctx.query as any),
        ...(ctx.request.body as any),
        ...(ctx.params as any),
      });
    } else {
      ctx.logger?.info(`err handle:${err.message}`, {
        trace_label: 'error',
        ...(ctx.query as any),
        ...(ctx.request.body as any),
        ...(ctx.params as any),
      });
    }
    ctx.body = { error: { message: err.message } };
    ctx.status = err.status || ComError.Status.InternalServerError;
  }
};

interface AskReq extends ChatRequest {
  site: Site;
}

interface AskRes extends ChatResponse {}

async function checkApiKey(ctx: Context, next: Next) {
  let secret = '';
  const authorStr =
    ctx.request.headers.authorization || ctx.request.headers['x-api-key'];
  secret = ((authorStr as string) || '').replace(/Bearer /, '');
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
  let {
    prompt,
    model = ModelType.GPT3p5Turbo,
    site = Site.You,
    ...rest
  } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as AskReq;
  if (model !== ModelType.GetGizmoInfo && !prompt) {
    throw new ComError(`need prompt in query`, ComError.Status.BadRequest);
  }
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  if (Config.config.global.enable_sensitive_check) {
    prompt = filterSensitiveWords(prompt);
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
  SaveMessagesToLogstash(req);
  console.debug(req.messages);
  ctx.body = data;
  return req;
};

const AskStreamHandle: (ESType: new () => EventStream) => Middleware =
  (ESType) => async (ctx) => {
    let {
      prompt,
      model = ModelType.GPT3p5Turbo,
      site = Site.You,
      search = false,
      ...rest
    } = {
      ...(ctx.query as any),
      ...(ctx.request.body as any),
      ...(ctx.params as any),
    } as AskReq;
    apm.currentTransaction?.addLabels({ site, model }, true);
    if (model !== ModelType.GetGizmoInfo && !prompt) {
      throw new ComError(`need prompt in query`, ComError.Status.BadRequest);
    }
    const chat = chatModel.get(site);
    if (!chat) {
      throw new ComError(
        `not support site: ${site} `,
        ComError.Status.NotFound,
      );
    }
    if (Config.config.global.enable_sensitive_check) {
      prompt = filterSensitiveWords(prompt);
    }
    let req: ChatRequest = {
      ...rest,
      search,
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
    ctx.logger.info('start', {
      model,
      params: {
        ...req,
        prompt: undefined,
      },
      trace_label: 'start',
    });
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
            (event, data: any) => {
              switch (event) {
                case Event.error:
                  ctx.logger.info(data.error, {
                    params: {
                      ...req,
                      prompt: undefined,
                    },
                    trace_label: 'error',
                  });
                  clearTimeout(timeout);
                  if (ctx.body) {
                    stream.write(event, data);
                    stream.write(Event.done, { content: '' });
                    stream.end();
                    return;
                  }
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
                  if (!ctx.body && !data.content) {
                    break;
                  }
                  clearTimeout(timeout);
                  if (!ok) {
                    break;
                  }
                  if (!ctx.body) {
                    ctx.append(
                      'Content-Type',
                      'text/event-stream;charset=utf-8',
                    );
                    ctx.append('Cache-Control', 'no-cache');
                    ctx.append('Connection', 'keep-alive');
                    ctx.body = stream.stream();
                    ctx.logger.info('recv', {
                      model,
                      params: {
                        ...req,
                        prompt: undefined,
                      },
                      trace_label: 'recv',
                    });
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
              delete (req as any).prompt;
              SaveMessagesToLogstash(req);
              ctx.logger.info(JSON.stringify(req), {
                model,
                params: {
                  ...req,
                  prompt: undefined,
                },
                trace_label: 'end',
              });
              stream.end();
            },
          );
          await chat.askStream(req, es).catch((err) => {
            console.log(
              `router chat.askStream failed, req:${JSON.stringify(req)} err:${
                err.message
              }`,
            );
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
  const req: ChatRequest = await AskHandle(ctx, next);
  let reqLen = countMessagesToken(messages);
  const tileSize = 512;
  const tokensPerTile = 170;
  for (const v of req.images || []) {
    const tilesForWidth = Math.ceil(v.width / tileSize);
    const tilesForHeight = Math.ceil(v.height / tileSize);
    const totalTiles = tilesForWidth * tilesForHeight;
    const totalTokens = 85 + tokensPerTile * totalTiles;
    reqLen += totalTokens;
  }
  const completion_tokens = getTokenCount(ctx.body.content || '');
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
      // 官方默认所有请求token都+7
      prompt_tokens: 7 + reqLen,
      completion_tokens,
      total_tokens: 7 + reqLen + completion_tokens,
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

const audioHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  await chat.speech(ctx, req);
};

const songCreateHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  await chat.createSong(ctx, req);
};

const songFeedHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  req.ids = req.ids.split(',');
  await chat.feedSong(ctx, req);
};

const audioTransHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;

  const fields: Record<string, any> = {}; // 用于存储需要解析的字段
  const formData = new FormData();
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: ctx.req.headers });
    const pt = new PassThrough();

    busboy.on('field', (fieldname: string, val: string) => {
      // 假设我们只需要解析特定的字段
      fields[fieldname] = val;
      formData.append(fieldname, val);
    });

    busboy.on(
      'file',
      async (
        fieldname: string,
        file: Stream,
        fileinfo: { filename: string; encoding: string; mimeType: string },
      ) => {
        const filePath = `run/file/${v4()}_${fileinfo.filename}`;
        file.pipe(fs.createWriteStream(filePath));
        await new Promise((resolve, reject) => {
          file.on('end', resolve);
          file.on('error', reject);
        });
        await sleep(500);
        fields[fieldname] = filePath;
        // 直接将文件流导向 passThrough，以便可以透传
        formData.append('file', fs.createReadStream(filePath), {
          filename: fileinfo.filename,
          contentType: fileinfo.mimeType,
        });
      },
    );

    busboy.on('error', reject);
    busboy.on('finish', resolve);
    ctx.req.pipe(busboy);
  });

  // @ts-ignore
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  await sleep(3000);
  await chat.transcriptions(ctx, { ...req, ...fields, form: formData });
};

const imageGenHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  await chat.generations(ctx, req);
};

const imagesEditsHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;

  const fields: Record<string, any> = {}; // 用于存储需要解析的字段
  const formData = new FormData();
  await new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: ctx.req.headers });

    busboy.on('field', (fieldname: string, val: string) => {
      // 假设我们只需要解析特定的字段
      fields[fieldname] = val;
      formData.append(fieldname, val);
    });

    busboy.on(
      'file',
      async (
        fieldname: string,
        file: Stream,
        fileinfo: { filename: string; encoding: string; mimeType: string },
      ) => {
        const filePath = `run/file/${v4()}_${fileinfo.filename}`;
        file.pipe(fs.createWriteStream(filePath));
        fields[fieldname] = filePath;
        // 直接将文件流导向 passThrough，以便可以透传
        formData.append(fieldname, fs.createReadStream(filePath), {
          filename: fileinfo.filename,
          contentType: fileinfo.mimeType,
        });
      },
    );

    busboy.on('error', reject);
    busboy.on('finish', resolve);
    busboy.on('close', resolve);
    ctx.req.pipe(busboy);
  });

  // @ts-ignore
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }

  await chat.ImagesEdits(ctx, { ...req, ...fields, form: formData });
};

const tokenizerHandle: Middleware = async (ctx, next) => {
  const params: { prompt: string } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const tokens = getTokenCount(params.prompt);
  ctx.body = { tokens };
};

const createVideoTaskHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  await chat.createVideoTask(ctx, req);
};

const queryVideoTaskHandle: Middleware = async (ctx, next) => {
  const { site, ...req } = {
    ...(ctx.query as any),
    ...(ctx.request.body as any),
    ...(ctx.params as any),
  } as any;
  const chat = chatModel.get(site);
  if (!chat) {
    throw new ComError(`not support site: ${site} `, ComError.Status.NotFound);
  }
  await chat.queryVideoTask(ctx, req);
};

function logRouters(router: Router) {
  router.stack.forEach((r) => {
    console.log(
      `${r.methods.join(',').padEnd(10)}${r.path.padEnd(40)}${
        r.opts?.name || ''
      }`,
    );
  });
}

export const chatSaveHandler = async (ctx: Context) => {
  const { data } = ctx.request.body as { data: ChatRequest[] };
  let saved = 0;
  for (const req of data) {
    if (!req.model || !req.messages?.length) {
      continue;
    }
    await SaveMessagesToLogstash(req);
    saved += 1;
  }
  console.log(`saved ${saved} chats, from: ${ctx.request.ip}`);
  ctx.body = { success: true, saved };
};

export const registerApp = () => {
  const app = new Koa();
  // 允许所有域名
  app.use(
    cors({
      origin: function (ctx) {
        return '*';
      },
    }),
  );
  const router = new Router();
  app.use(errorHandler);
  app.use(bodyParser({ jsonLimit: '100mb' }));
  app.use(checkApiKey);
  router.get('/webshow/:site', async (ctx) => {
    const model = chatModel.get(ctx.params.site as Site);
    if (!model) {
      ctx.status = 404;
      ctx.body = 'not found';
      return;
    }
    ctx.set('Content-Type', 'text/html');
    await model.webshow(ctx);
  });
  router.post('/pow', powHandler);
  router.get('/supports', supportsHandler);
  router.get('/ask', AskHandle);
  router.post('/ask', AskHandle);
  router.get('/ask/stream', AskStreamHandle(EventStream));
  router.post('/ask/stream', AskStreamHandle(EventStream));
  router.post('/v1/chat/completions', openAIHandle);
  router.post('/:site/v1/chat/completions', openAIHandle);
  router.post('/v1/complete', claudeHandle);
  router.post('/:site/v1/complete', claudeHandle);
  router.post('/v1/audio/speech', audioHandle);
  router.post('/:site/v1/audio/speech', audioHandle);
  router.post('/:site/v1/images/generations', imageGenHandle);
  router.post('/:site/v1/images/edits', imagesEditsHandle);
  router.post('/v1/images/edits', imagesEditsHandle);
  router.get('/v1/tokenizer', tokenizerHandle);
  router.post('/v1/tokenizer', tokenizerHandle);
  router.post('/v1/video/create', createVideoTaskHandle);
  router.post('/:site/v1/video/create', createVideoTaskHandle);
  router.get('/v1/video/query', queryVideoTaskHandle);
  router.get('/:site/v1/video/query', queryVideoTaskHandle);
  router.post('/:site/v1/audio/transcriptions', audioTransHandle);
  router.post('/v1/audio/transcriptions', audioTransHandle);
  router.post('/v1/song/create', songCreateHandle);
  router.post('/:site/v1/song/create', songCreateHandle);
  router.get('/v1/song/feed', songFeedHandle);
  router.get('/:site/v1/song/feed', songFeedHandle);
  router.post(
    '/chat/save',
    checkBody({
      data: Joi.array()
        .items(
          Joi.object({
            model: Joi.string().required(),
          }).unknown(true),
        )
        .min(1),
    }),
    chatSaveHandler,
  );
  chatModel.forEach((chat, site) => {
    // 增加前缀 dynamic/:site
    const dynamicRouter = new Router({ prefix: `/dynamic/${site}` });
    if (chat.dynamicRouter(dynamicRouter)) {
      app.use(dynamicRouter.routes());
      logRouters(dynamicRouter);
    }
  });

  app.use(router.routes());
  logRouters(router);
  const port = +(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log(`Now listening: 127.0.0.1:${port}`);
  });
  console.log(`Worker ${process.pid} started`);
};
