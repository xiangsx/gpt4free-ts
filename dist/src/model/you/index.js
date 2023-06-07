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
exports.You = void 0;
const uuid_1 = require("uuid");
//@ts-ignore
const user_agents_1 = __importDefault(require("user-agents"));
const utils_1 = require("../../utils");
const base_1 = require("../base");
const proxyAgent_1 = require("../../utils/proxyAgent");
const userAgent = new user_agents_1.default();
class You extends base_1.Chat {
    constructor(props) {
        super(props);
        this.session = (0, proxyAgent_1.CreateTlsProxy)({ clientIdentifier: 'chrome_108' });
        this.session.headers = this.getHeaders();
    }
    request(req) {
        return __awaiter(this, void 0, void 0, function* () {
            let { page = 1, count = 10, safeSearch = 'Moderate', onShoppingPage = 'False', mkt = '', responseFilter = 'WebPages,Translations,TimeZone,Computation,RelatedSearches', domain = 'youchat', queryTraceId = null, chat = null, includeLinks = 'False', detailed = 'False', debug = 'False', } = req.options || {};
            if (!chat) {
                chat = [];
            }
            return yield this.session.get('https://you.com/api/streamingSearch', {
                params: {
                    q: req.prompt,
                    page: page + '',
                    count: count + '',
                    safeSearch: safeSearch + '',
                    onShoppingPage: onShoppingPage + '',
                    mkt: mkt + '',
                    responseFilter: responseFilter + '',
                    domain: domain + '',
                    queryTraceId: queryTraceId || (0, uuid_1.v4)(),
                    chat: JSON.stringify(chat),
                },
            });
        });
    }
    askStream(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.request(req);
            return { text: (0, utils_1.toEventStream)(response.content), other: {} };
        });
    }
    ask(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.request(req);
            return new Promise((resolve) => {
                const res = {
                    text: '',
                    other: {},
                };
                (0, utils_1.toEventCB)(response.content, (eventName, data) => {
                    let obj;
                    switch (eventName) {
                        case 'youChatToken':
                            obj = (0, utils_1.parseJSON)(data, {});
                            res.text += obj.youChatToken;
                            break;
                        case 'done':
                            resolve(res);
                            return;
                        default:
                            obj = (0, utils_1.parseJSON)(data, {});
                            res.other[eventName] = obj;
                            return;
                    }
                });
            });
        });
    }
    getHeaders() {
        return {
            authority: 'you.com',
            accept: 'text/event-stream',
            'accept-language': 'en,fr-FR;q=0.9,fr;q=0.8,es-ES;q=0.7,es;q=0.6,en-US;q=0.5,am;q=0.4,de;q=0.3',
            'cache-control': 'no-cache',
            referer: 'https://you.com/search?q=who+are+you&tbm=youchat',
            'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            cookie: `safesearch_guest=Moderate; uuid_guest=${(0, uuid_1.v4)()}`,
            'user-agent': userAgent.toString(),
        };
    }
}
exports.You = You;
