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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mcbbs = void 0;
const base_1 = require("../base");
const proxyAgent_1 = require("../../utils/proxyAgent");
const event_stream_1 = __importDefault(require("event-stream"));
const utils_1 = require("../../utils");
class Mcbbs extends base_1.Chat {
    constructor(options) {
        super(options);
        this.client = (0, proxyAgent_1.CreateAxiosProxy)({
            baseURL: 'https://ai.mcbbs.gq/api',
            headers: {
                'Content-Type': 'application/json',
                accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Proxy-Connection': 'keep-alive',
            },
        });
    }
    ask(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.askStream(req);
            const result = {
                text: '',
                other: {},
            };
            return new Promise((resolve) => {
                res.text
                    .on('data', (data) => {
                    result.text += data;
                })
                    .on('close', () => {
                    resolve(result);
                });
            });
        });
    }
    askStream(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const { messages, temperature = 1, parse = 'true' } = req.options;
            const data = {
                stream: true,
                messages: JSON.parse(messages),
                temperature,
                presence_penalty: 2,
                model: 'gpt-3.5-turbo',
            };
            const res = yield this.client.post('/openai/v1/chat/completions', data, {
                responseType: 'stream',
            });
            if (parse === 'false') {
                return { text: res.data };
            }
            return {
                text: this.parseData(res.data),
            };
        });
    }
    parseData(v) {
        return v.pipe(event_stream_1.default.split(/\r?\n\r?\n/)).pipe(event_stream_1.default.map((chunk, cb) => __awaiter(this, void 0, void 0, function* () {
            const dataStr = chunk.replace('data: ', '');
            if (dataStr === '[Done]') {
                cb(null, '');
                return;
            }
            const data = (0, utils_1.parseJSON)(dataStr, {});
            if (!(data === null || data === void 0 ? void 0 : data.choices)) {
                cb(null, '');
                return;
            }
            const [{ delta: { content = '' }, },] = data.choices;
            cb(null, content);
        })));
    }
}
exports.Mcbbs = Mcbbs;
