"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const koa_1 = __importDefault(require("koa"));
const koa_router_1 = __importDefault(require("koa-router"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const model_1 = require("./model");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = new koa_1.default();
const router = new koa_router_1.default();
const errorHandler = (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield next();
    }
    catch (err) {
        console.error(err);
        ctx.body = JSON.stringify(err);
        ctx.res.end();
    }
});
app.use(errorHandler);
app.use((0, koa_bodyparser_1.default)());
const chatModel = new model_1.ChatModelFactory();
router.get('/ask', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const _a = ctx.query, { prompt, model = model_1.Model.Mcbbs } = _a, options = __rest(_a, ["prompt", "model"]);
    if (!prompt) {
        ctx.body = 'please input prompt';
        return;
    }
    const chat = chatModel.get(model);
    if (!chat) {
        ctx.body = 'Unsupported  model';
        return;
    }
    const res = yield chat.ask({ prompt: prompt, options });
    ctx.body = res.text;
}));
router.get('/ask/stream', (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const _b = ctx.query, { prompt, model = model_1.Model.Mcbbs } = _b, options = __rest(_b, ["prompt", "model"]);
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
        'Content-Type': 'text/event-stream;charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    const res = yield chat.askStream({ prompt: prompt, options });
    ctx.body = res === null || res === void 0 ? void 0 : res.text;
}));
app.use(router.routes());
(() => __awaiter(void 0, void 0, void 0, function* () {
    const server = app.listen(3000, () => {
        console.log('Now listening: 127.0.0.1:3000');
    });
    process.on('SIGINT', () => {
        server.close(() => {
            process.exit(0);
        });
    });
}))();
