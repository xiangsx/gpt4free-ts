"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.Forefrontnew = void 0;
const base_1 = require("../base");
const puppeteer_1 = require("../../pool/puppeteer");
const emailFactory_1 = require("../../utils/emailFactory");
const proxyAgent_1 = require("../../utils/proxyAgent");
const fs = __importStar(require("fs"));
const utils_1 = require("../../utils");
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const eventstream_1 = require("../../utils/eventstream");
const MaxGptTimes = 4;
const TimeFormat = 'YYYY-MM-DD HH:mm:ss';
class AccountPool {
    constructor() {
        this.pool = [];
        this.account_file_path = './run/account.json';
        if (fs.existsSync(this.account_file_path)) {
            const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
            this.pool = (0, utils_1.parseJSON)(accountStr, []);
        }
        else {
            fs.mkdirSync('./run', { recursive: true });
            this.syncfile();
        }
    }
    syncfile() {
        fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
    }
    getByID(id) {
        for (const item of this.pool) {
            if (item.id === id) {
                return item;
            }
        }
    }
    get() {
        const now = (0, moment_1.default)();
        const minInterval = 3 * 60 * 60 + 10 * 60; // 3hour + 10min
        for (const item of this.pool) {
            if (now.unix() - (0, moment_1.default)(item.last_use_time).unix() > minInterval) {
                console.log(`find old login account:`, item);
                item.last_use_time = now.format(TimeFormat);
                this.syncfile();
                return item;
            }
        }
        const newAccount = {
            id: (0, uuid_1.v4)(),
            last_use_time: now.format(TimeFormat),
            gpt4times: 0,
        };
        this.pool.push(newAccount);
        this.syncfile();
        return newAccount;
    }
    multiGet(size) {
        const result = [];
        for (let i = 0; i < size; i++) {
            result.push(this.get());
        }
        return result;
    }
}
class Forefrontnew extends base_1.Chat {
    constructor(options) {
        super(options);
        this.accountPool = new AccountPool();
        const maxSize = +(process.env.POOL_SIZE || 2);
        const initialAccounts = this.accountPool.multiGet(maxSize);
        this.pagePool = new puppeteer_1.BrowserPool(maxSize, initialAccounts.map((item) => item.id), this.init.bind(this));
    }
    ask(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.askStream(req);
            let text = '';
            return new Promise((resolve) => {
                const et = new eventstream_1.ReadEventStream(res.text);
                et.read(({ event, data }) => {
                    if (!data) {
                        return;
                    }
                    switch (event) {
                        case 'data':
                            text += data;
                            break;
                        case 'done':
                            text = data;
                            break;
                        default:
                            console.error(data);
                            break;
                    }
                }, () => {
                    resolve({ text, other: res.other });
                });
            });
        });
    }
    tryValidate(validateURL, triedTimes) {
        return __awaiter(this, void 0, void 0, function* () {
            if (triedTimes === 3) {
                throw new Error('validate failed');
            }
            triedTimes += 1;
            try {
                const tsl = yield (0, proxyAgent_1.CreateTlsProxy)({ clientIdentifier: 'chrome_108' }).get(validateURL);
            }
            catch (e) {
                console.log(e);
                yield this.tryValidate(validateURL, triedTimes);
            }
        });
    }
    static switchToGpt4(page, triedTimes = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            if (triedTimes === 3) {
                yield page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                yield page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                return;
            }
            try {
                console.log('switch gpt4....');
                triedTimes += 1;
                yield page.waitForTimeout(2000);
                yield page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                yield page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                yield page.waitForTimeout(1000);
                yield page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                yield page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                yield page.waitForTimeout(1000);
                yield page.hover('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
                yield page.waitForSelector('.px-4 > .flex > .grid > .h-9 > .grow');
                yield page.click('.px-4 > .flex > .grid > .h-9 > .grow');
                yield page.waitForSelector('.flex > .grid > .block > .sticky > .text-sm');
                yield page.click('.flex > .grid > .block > .sticky > .text-sm');
                yield page.keyboard.type('helpful', { delay: 10 });
                yield page.waitForSelector('.px-4 > .flex > .grid > .block > .group');
                yield page.click('.px-4 > .flex > .grid > .block > .group');
                console.log('switch gpt4 ok!');
            }
            catch (e) {
                console.log(e);
                yield page.reload();
                yield Forefrontnew.switchToGpt4(page, triedTimes);
            }
        });
    }
    allowClipboard(browser, page) {
        return __awaiter(this, void 0, void 0, function* () {
            const context = browser.defaultBrowserContext();
            yield context.overridePermissions('https://chat.forefront.ai', ['clipboard-read', 'clipboard-write']);
            yield page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
                value: {
                    //@ts-ignore
                    writeText(text) {
                        this.text = text;
                    },
                },
            }));
        });
    }
    init(id, browser) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const account = this.accountPool.getByID(id);
                if (!account) {
                    throw new Error('account undefined, something error');
                }
                const [page] = yield browser.pages();
                if (account.login_time) {
                    yield page.goto('https://chat.forefront.ai/');
                    yield page.setViewport({ width: 1920, height: 1080 });
                    yield this.allowClipboard(browser, page);
                    yield Forefrontnew.switchToGpt4(page);
                    return [page, account];
                }
                yield page.goto('https://accounts.forefront.ai/sign-up');
                yield page.setViewport({ width: 1920, height: 1080 });
                yield page.waitForSelector('#emailAddress-field');
                yield page.click('#emailAddress-field');
                yield page.waitForSelector('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary');
                yield page.click('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary');
                const emailBox = (0, emailFactory_1.CreateEmail)(process.env.EMAIL_TYPE || emailFactory_1.TempEmailType.TempEmail44);
                const emailAddress = yield emailBox.getMailAddress();
                account.email = emailAddress;
                this.accountPool.syncfile();
                // 将文本键入焦点元素
                yield page.keyboard.type(emailAddress, { delay: 10 });
                yield page.keyboard.press('Enter');
                const msgs = (yield emailBox.waitMails());
                let validateURL;
                for (const msg of msgs) {
                    validateURL = (_a = msg.content.match(/https:\/\/clerk\.forefront\.ai\/v1\/verify\?token=[^\s"]+/i)) === null || _a === void 0 ? void 0 : _a[0];
                    if (validateURL) {
                        break;
                    }
                }
                if (!validateURL) {
                    throw new Error('Error while obtaining verfication URL!');
                }
                yield this.tryValidate(validateURL, 0);
                console.log('register successfully');
                account.login_time = (0, moment_1.default)().format(TimeFormat);
                this.accountPool.syncfile();
                yield page.waitForSelector('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)', { timeout: 10000 });
                yield page.click('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)');
                yield page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', { timeout: 10000 });
                yield this.allowClipboard(browser, page);
                yield Forefrontnew.switchToGpt4(page);
                return [page, account];
            }
            catch (e) {
                return [];
            }
        });
    }
    askStream(req) {
        return __awaiter(this, void 0, void 0, function* () {
            const [page, account, done, destroy] = this.pagePool.get();
            const pt = new eventstream_1.WriteEventStream();
            if (!account || !page) {
                pt.write('error', 'please wait init.....about 1 min');
                pt.end();
                return { text: pt.stream };
            }
            console.log('try to find input');
            yield page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {
                timeout: 10000,
                visible: true,
            });
            console.log('found');
            yield page.click('.relative > .flex > .w-full > .text-th-primary-dark > div');
            yield page.focus('.relative > .flex > .w-full > .text-th-primary-dark > div');
            yield page.keyboard.type(req.prompt, { delay: 10 });
            yield page.keyboard.press('Enter');
            yield page.waitForSelector('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
            // find markdown list container
            const mdList = yield page.$('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
            const md = mdList;
            // get latest markdown id
            let id = 4;
            const selector = `div > .w-full:nth-child(${id}) > .flex > .flex > .post-markdown`;
            yield page.waitForSelector(selector);
            const result = yield page.$(selector);
            // get latest markdown text
            let oldText = '';
            (() => __awaiter(this, void 0, void 0, function* () {
                const itl = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    const text = yield (result === null || result === void 0 ? void 0 : result.evaluate((el) => {
                        return el.textContent;
                    }));
                    if (typeof text != 'string') {
                        return;
                    }
                    if (oldText.length === text.length) {
                        return;
                    }
                    pt.write('data', text.slice(oldText.length - text.length));
                    oldText = text;
                }), 100);
                if (!page) {
                    return;
                }
                try {
                    yield page.waitForSelector('.opacity-100 > .flex > .relative:nth-child(2) > .flex > .cursor-pointer');
                    yield page.click('.opacity-100 > .flex > .relative:nth-child(2) > .flex > .cursor-pointer');
                    //@ts-ignore
                    const text = yield page.evaluate(() => navigator.clipboard.text);
                    console.log('chat end: ', text);
                    pt.write('done', text);
                }
                catch (e) {
                    console.error(e);
                }
                finally {
                    pt.end();
                    yield page.waitForSelector('.flex:nth-child(1) > div:nth-child(2) > .relative > .flex > .cursor-pointer');
                    yield page.click('.flex:nth-child(1) > div:nth-child(2) > .relative > .flex > .cursor-pointer');
                    account.gpt4times += 1;
                    this.accountPool.syncfile();
                    if (account.gpt4times >= MaxGptTimes) {
                        account.gpt4times = 0;
                        account.last_use_time = (0, moment_1.default)().format(TimeFormat);
                        this.accountPool.syncfile();
                        const newAccount = this.accountPool.get();
                        destroy(newAccount.id);
                    }
                    else {
                        done(account);
                    }
                    clearInterval(itl);
                }
            }))().then();
            return { text: pt.stream };
        });
    }
}
exports.Forefrontnew = Forefrontnew;
