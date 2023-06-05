import Koa, {Context, Next} from 'koa';
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser';
import {ChatModelFactory, Model} from "./model";
import dotenv from 'dotenv';

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
app.use(bodyParser());
const chatModel = new ChatModelFactory();

interface AskReq {
    prompt: string;
    model: Model;
}

router.get('/ask', async (ctx) => {
    const {prompt, model = Model.Mcbbs, ...options} = ctx.query as unknown as AskReq;
    if (!prompt) {
        ctx.body = 'please input prompt';
        return;
    }
    const chat = chatModel.get(model);
    if (!chat) {
        ctx.body = 'Unsupported  model';
        return;
    }
    const res = await chat.ask({prompt: prompt as string, options});
    ctx.body = res.text;
});

router.get('/ask/stream', async (ctx) => {
    const {prompt, model = Model.Mcbbs, ...options} = ctx.query as unknown as AskReq;
    if (!prompt) {
        ctx.body = 'please input prompt';
        return;
    }
    const chat = chatModel.get(model);
    if (!chat) {
        ctx.body = 'Unsupported  model';
        return;
    }
    ctx.set({
        "Content-Type": "text/event-stream;charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });
    const res = await chat.askStream({prompt: prompt as string, options});
    ctx.body = res?.text;
})

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
})()

