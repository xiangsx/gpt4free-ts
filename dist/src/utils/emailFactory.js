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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateEmail = exports.TempEmailType = void 0;
const index_1 = require("./index");
const proxyAgent_1 = require("./proxyAgent");
var TempEmailType;
(function (TempEmailType) {
    // need credit card https://rapidapi.com/Privatix/api/temp-mail
    TempEmailType["TempEmail"] = "temp-email";
    // not need credit card , hard limit 100/day https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44
    TempEmailType["TempEmail44"] = "temp-email44";
})(TempEmailType = exports.TempEmailType || (exports.TempEmailType = {}));
function CreateEmail(tempMailType, options) {
    switch (tempMailType) {
        case TempEmailType.TempEmail44:
            return new TempMail44(options);
        case TempEmailType.TempEmail:
            return new TempMail(options);
        default:
            throw new Error('not support TempEmailType');
    }
}
exports.CreateEmail = CreateEmail;
class BaseEmail {
    constructor(options) {
    }
}
class TempMail extends BaseEmail {
    constructor(options) {
        super(options);
        this.mailID = '';
        const apikey = (options === null || options === void 0 ? void 0 : options.apikey) || process.env.rapid_api_key;
        if (!apikey) {
            throw new Error('Need apikey for TempMail');
        }
        this.client = (0, proxyAgent_1.CreateAxiosProxy)({
            baseURL: 'https://privatix-temp-mail-v1.p.rapidapi.com/request/',
            headers: {
                'X-RapidAPI-Key': apikey,
                'X-RapidAPI-Host': 'privatix-temp-mail-v1.p.rapidapi.com'
            }
        });
    }
    getMailAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            this.address = `${(0, index_1.randomStr)()}${yield this.randomDomain()}`;
            this.mailID = (0, index_1.md5)(this.address);
            return this.address;
        });
    }
    waitMails() {
        return __awaiter(this, void 0, void 0, function* () {
            const mailID = this.mailID;
            return new Promise(resolve => {
                let time = 0;
                const itl = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    const response = yield this.client.get(`/mail/id/${mailID}`);
                    if (response.data && response.data.length > 0) {
                        resolve(response.data.map((item) => (Object.assign(Object.assign({}, item), { content: item.mail_html }))));
                        clearInterval(itl);
                        return;
                    }
                    if (time > 5) {
                        resolve([]);
                        clearInterval(itl);
                        return;
                    }
                    time++;
                }), 5000);
            });
        });
    }
    getDomainsList() {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.client.get(`/domains/`);
            return res.data;
        });
    }
    randomDomain() {
        return __awaiter(this, void 0, void 0, function* () {
            const domainList = yield this.getDomainsList();
            return domainList[Math.floor(Math.random() * domainList.length)];
        });
    }
}
class TempMail44 extends BaseEmail {
    constructor(options) {
        super(options);
        this.address = '';
        const apikey = (options === null || options === void 0 ? void 0 : options.apikey) || process.env.rapid_api_key;
        if (!apikey) {
            throw new Error('Need apikey for TempMail');
        }
        this.client = (0, proxyAgent_1.CreateAxiosProxy)({
            baseURL: 'https://temp-mail44.p.rapidapi.com/api/v3/email/',
            headers: {
                'X-RapidAPI-Key': apikey,
                'X-RapidAPI-Host': 'temp-mail44.p.rapidapi.com'
            }
        });
    }
    getMailAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.client.post('/new', {}, {
                headers: {
                    'content-type': 'application/json',
                }
            });
            this.address = response.data.email;
            return this.address;
        });
    }
    waitMails() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => {
                let time = 0;
                const itl = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    const response = yield this.client.get(`/${this.address}/messages`);
                    if (response.data && response.data.length > 0) {
                        resolve(response.data.map((item) => (Object.assign(Object.assign({}, item), { content: item.body_html }))));
                        clearInterval(itl);
                        return;
                    }
                    if (time > 5) {
                        resolve([]);
                        clearInterval(itl);
                        return;
                    }
                    time++;
                }), 5000);
            });
        });
    }
}
