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
exports.AiDream = void 0;
const base_1 = require("../base");
const proxyAgent_1 = require("../../utils/proxyAgent");
const event_stream_1 = __importDefault(require("event-stream"));
const utils_1 = require("../../utils");
class AiDream extends base_1.Chat {
    constructor(options) {
        super(options);
        this.client = (0, proxyAgent_1.CreateAxiosProxy)({
            baseURL: 'http://aidream.cloud/api/',
            headers: {
                'Cache-Control': 'no-cache',
                'Proxy-Connection': 'keep-alive',
            },
        });
    }
    ask(req) {
        return __awaiter(this, void 0, void 0, function* () {
            req.options.parse = false;
            const res = yield this.askStream(req);
            const result = {
                text: '',
                other: {},
            };
            return new Promise((resolve) => {
                res.text
                    .pipe(event_stream_1.default.split(/\r?\n/))
                    .pipe(event_stream_1.default.map((chunk, cb) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const data = (0, utils_1.parseJSON)(chunk, {});
                    if (!((_a = data === null || data === void 0 ? void 0 : data.detail) === null || _a === void 0 ? void 0 : _a.choices)) {
                        cb(null, '');
                        return;
                    }
                    const [{ delta: { content }, },] = data.detail.choices;
                    result.other.parentMessageId = data.parentMessageId;
                    cb(null, content);
                })))
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
            const { prompt = '' } = req;
            const { systemMessage = "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown.", temperature = 1.0, top_p = 1, parentMessageId, parse = true, } = req.options;
            const data = {
                options: { parentMessageId },
                prompt,
                systemMessage,
                temperature,
                top_p,
            };
            const res = yield this.client.post('/chat-process', data, {
                responseType: 'stream',
            });
            if (parse) {
                return {
                    text: this.parseData(res.data),
                };
            }
            return { text: res.data };
        });
    }
    parseData(v) {
        return v.pipe(event_stream_1.default.split(/\r?\n/)).pipe(event_stream_1.default.map((chunk, cb) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const data = (0, utils_1.parseJSON)(chunk, {});
            if (!((_a = data === null || data === void 0 ? void 0 : data.detail) === null || _a === void 0 ? void 0 : _a.choices)) {
                cb(null, '');
                return;
            }
            const [{ delta: { content }, },] = data.detail.choices;
            cb(null, content);
        })));
    }
}
exports.AiDream = AiDream;
