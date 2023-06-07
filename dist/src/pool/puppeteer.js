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
exports.BrowserPool = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = __importDefault(require("path"));
const runPath = path_1.default.join(__dirname, 'run');
class BrowserPool {
    constructor(size, initialIDs, prepare) {
        this.pool = [];
        this.size = size;
        this.prepare = prepare;
        this.init(initialIDs);
    }
    init(initialIDs) {
        for (let i = 0; i < this.size; i++) {
            const id = initialIDs[i];
            const info = {
                id,
                ready: false,
            };
            this.initOne(id)
                .then(([page, data]) => {
                if (!page) {
                    return;
                }
                info.page = page;
                info.data = data;
                info.ready = true;
            })
                .catch((e) => {
                console.error(e);
            });
            this.pool.push(info);
        }
    }
    initOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                headless: process.env.DEBUG === '1' ? false : 'new',
                args: ['--no-sandbox'],
            };
            if (id) {
                options.userDataDir = `run/${id}`;
            }
            let browser;
            try {
                browser = yield puppeteer_1.default.launch(options).catch((err) => {
                    console.log(err);
                });
            }
            catch (error) { }
            return this.prepare(id, browser);
        });
    }
    //@ts-ignore
    get() {
        for (const item of this.pool) {
            if (item.ready) {
                item.ready = false;
                return [
                    item.page,
                    item.data,
                    (data) => {
                        item.ready = true;
                        item.data = data;
                    },
                    (newID) => {
                        var _a;
                        (_a = item.page) === null || _a === void 0 ? void 0 : _a.close();
                        this.initOne(newID).then(([page, data]) => {
                            item.page = page;
                            item.data = data;
                            item.ready = true;
                        });
                    },
                ];
            }
        }
        return [];
    }
}
exports.BrowserPool = BrowserPool;
