import {You} from "./model/you";
import Koa from 'koa';
import Router from 'koa-router'
import bodyParser from 'koa-bodyparser';

const app = new Koa();
const router = new Router();
app.use(bodyParser());
const you = new You({proxy: process.env.https_proxy || process.env.http_proxy});

interface AskReq {
    prompt: string;
}

router.get('/ask', async (ctx) => {
    const {prompt} = ctx.query;
    if (!prompt) {
        ctx.body = 'please input prompt';
        return;
    }
    const res = await you.ask({prompt: prompt as string});
    ctx.body = res.text;
});

router.get('/ask/stream', async (ctx) => {
    const {prompt} = ctx.query;
    if (!prompt) {
        ctx.body = 'please input prompt';
        return;
    }
    ctx.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    })
    const res = await you.askStream({prompt: prompt as string});
    ctx.body = res.text;
})

app.use(router.routes());

app.listen(3000);
