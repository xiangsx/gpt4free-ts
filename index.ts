import Koa from 'koa';
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser';
import {ChatModelFactory, Model} from "./model";

const app = new Koa();
const router = new Router();
app.use(bodyParser());
const chatModel = new ChatModelFactory({proxy: process.env.https_proxy || process.env.http_proxy});

interface AskReq {
    prompt: string;
    model: Model;
}

router.get('/ask', async (ctx) => {
    const {prompt, model = Model.You} = ctx.query as unknown as AskReq;
    if (!prompt) {
        ctx.body = 'please input prompt';
        return;
    }
    const chat = chatModel.get(model);
    if (!chat) {
        ctx.body = 'Unsupported  model';
        return;
    }
    const res = await chat.ask({prompt: prompt as string});
    ctx.body = res.text;
});

router.get('/ask/stream', async (ctx) => {
    const {prompt, model = Model.You} = ctx.query as unknown as AskReq;
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
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });
    const res = await chat.askStream({prompt: prompt as string});
    ctx.body = res.text;
})

app.use(router.routes());

app.listen(3000,()=>{
    console.log("Now listening: 127.0.0.1:3000");
});
