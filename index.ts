import Koa, {Context, Middleware, Next} from 'koa';
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser';
import {ChatModelFactory, Site} from "./model";
import dotenv from 'dotenv';
import {ChatRequest, ChatResponse, Message, ModelType, PromptToString} from "./model/base";
import {Event, EventStream, getTokenSize, OpenaiEventStream, randomStr} from "./utils";
import moment from "moment";

process.setMaxListeners(30);  // 将限制提高到20个

dotenv.config();

const app = new Koa();
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
app.use(bodyParser({jsonLimit: '10mb'}));
const chatModel = new ChatModelFactory();

interface AskReq extends ChatRequest {
    site: Site;
}

interface AskRes extends ChatResponse {
}

const AskHandle: Middleware = async (ctx) => {
    const {
        prompt,
        model = ModelType.GPT3p5Turbo,
        site = Site.You
    } = {...ctx.query as any, ...ctx.request.body as any, ...ctx.params as any} as AskReq;
    if (!prompt) {
        ctx.body = {error: `need prompt in query`} as AskRes;
        return;
    }
    const chat = chatModel.get(site);
    if (!chat) {
        ctx.body = {error: `not support site: ${site} `} as AskRes;
        return;
    }
    const tokenLimit = chat.support(model);
    if (!tokenLimit) {
        ctx.body = {error: `${site} not support model ${model}`} as AskRes;
        return;
    }
    ctx.body = await chat.ask({prompt: PromptToString(prompt, tokenLimit), model});
}

const AskStreamHandle: (ESType: new () => EventStream) => Middleware = (ESType) => async (ctx) => {
    const {
        prompt,
        model = ModelType.GPT3p5Turbo,
        site = Site.You
    } = {...ctx.query as any, ...ctx.request.body as any, ...ctx.params as any} as AskReq;
    ctx.set({
        "Content-Type": "text/event-stream;charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });
    let es = new ESType();
    ctx.body = es.stream();
    if (!prompt) {
        es.write(Event.error, {error: 'need prompt in query'})
        es.end();
        return;
    }
    const chat = chatModel.get(site);
    if (!chat) {
        es.write(Event.error, {error: `not support site: ${site} `})
        es.end();
        return;
    }
    const tokenLimit = chat.support(model);
    if (!tokenLimit) {
        es.write(Event.error, {error: `${site} not support model ${model}`})
        es.end();
        return;
    }
    await chat.askStream({prompt: PromptToString(prompt, tokenLimit), model}, es);
    ctx.body = es.stream();
}

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
        const support: Support = {site: site, models: []}
        for (const mKey in ModelType) {
            //@ts-ignore
            const model = ModelType[mKey];
            //@ts-ignore
            if (chat?.support(model)) {
                support.models.push(model);
            }
        }
        result.push(support)
    }
    ctx.body = result;
});
router.get('/ask', AskHandle);
router.post('/ask', AskHandle);
router.get('/ask/stream', AskStreamHandle(EventStream))
router.post('/ask/stream', AskStreamHandle(EventStream))
const openAIHandle: Middleware = async (ctx, next) => {
    const {stream} = {...ctx.query as any, ...ctx.request.body as any, ...ctx.params as any} as OpenAIReq;
    (ctx.request.body as any).prompt = JSON.stringify((ctx.request.body as any).messages);
    if (stream) {
        AskStreamHandle(OpenaiEventStream)(ctx, next);
        return;
    }
    await AskHandle(ctx, next);
    console.log(ctx.body);
    ctx.body = {
        "id": `chatcmpl-${randomStr()}`,
        "object": "chat.completion",
        "created": moment().unix(),
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": ctx.body.content || ctx.body.error,
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": getTokenSize(ctx.body.content || ''),
            "total_tokens": 100 + getTokenSize(ctx.body.content || '')
        }
    }
};

router.post('/v1/chat/completions', openAIHandle)
router.post('/:site/v1/chat/completions', openAIHandle)

app.use(router.routes());

(async () => {
    const server = app.listen(3000, () => {
        console.log("Now listening: 127.0.0.1:3000");
    });
    process.on('SIGINT', () => {
        server.close(() => {
            process.exit(0);
        });
    });
    process.on('uncaughtException', (e) => {
        console.error(e);
    })
})()

