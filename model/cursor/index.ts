import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import * as fs from "fs";
import {
    DoneData,
    encodeBase64,
    ErrorData,
    Event,
    EventStream,
    MessageData,
    parseJSON,
    randomStr,
    sleep
} from "../../utils";
import {v4} from "uuid";
import moment from 'moment';
import TurndownService from 'turndown';
import {AxiosInstance, AxiosRequestConfig} from "axios";
import es from "event-stream";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import crypto from "crypto";
import {BaseOptions} from "vm";

const turndownService = new TurndownService({codeBlockStyle: 'fenced'});

type PageData = {
    gpt4times: number;
}

const MaxGptTimes = 50;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    password?: string;
    gpt4times: number;
    token?: string;
}

interface ConversationMessage {
    text?: string;
    type: string;
}

interface Context {
    context: string;
}

interface ModelDetails {
    modelName: string;
    azureState: {};
}

interface RealReq {
    conversation: ConversationMessage[];
    explicitContext?: Context;
    workspaceRootPath?: string;
    modelDetails: ModelDetails;
    requestId: string;
}

type AuthRes = {
    accessToken: string;
    refreshToken: string;
    challenge: string;
    authId: string;
    uuid: string;
}

class CursorAccountPool {
    private pool: Account[] = [];
    private readonly account_file_path = './run/account_cursor.json';
    private using = new Set<string>();

    constructor() {
        if (fs.existsSync(this.account_file_path)) {
            const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
            this.pool = parseJSON(accountStr, [] as Account[]);
        } else {
            fs.mkdirSync('./run', {recursive: true});
            this.syncfile();
        }
    }

    public syncfile() {
        fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
    }

    public getByID(id: string) {
        for (const item of this.pool) {
            if (item.id === id) {
                return item;
            }
        }
    }

    public delete(id: string) {
        this.pool = this.pool.filter(item => item.id !== id);
        this.syncfile();
    }

    public get(): Account {
        const now = moment();
        for (const item of this.pool) {
            if (item.gpt4times + 1 <= MaxGptTimes && !this.using.has(item.id)) {
                console.log(`find old login account:`, item);
                item.last_use_time = now.format(TimeFormat);
                this.syncfile();
                this.using.add(item.id);
                return item;
            }
        }
        const newAccount: Account = {
            id: v4(),
            last_use_time: now.format(TimeFormat),
            gpt4times: 0,
        }
        this.pool.push(newAccount);
        this.syncfile();
        this.using.add(newAccount.id);
        return newAccount
    }

    public multiGet(size: number): Account[] {
        const result: Account[] = [];
        for (let i = 0; i < size; i++) {
            result.push(this.get());
        }
        return result
    }
}

interface CursorOptions extends ChatOptions {
    model: ModelType;
}


export class Cursor extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private accountPool: CursorAccountPool;
    private client: AxiosInstance;

    constructor(options?: BaseOptions) {
        super(options);
        this.accountPool = new CursorAccountPool();
        let maxSize = +(process.env.CURSOR_POOL_SIZE || 0);
        this.pagePool = new BrowserPool<Account>(maxSize, this, false);
        this.client = CreateAxiosProxy({
            baseURL: 'https://api2.cursor.sh',
            headers: {
                origin: "vscode-file://vscode-app",
                "User-Agent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/0.4.2 Chrome/108.0.5359.215 Electron/22.3.10 Safari/537.36',
            }
        }, false);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT4:
                return 6000;
            case ModelType.GPT3p5Turbo:
                return 4000;
            default:
                return 0;
        }
    }

    public async ask(req: ChatRequest): Promise<ChatResponse> {
        const et = new EventStream();
        const res = await this.askStream(req, et);
        const result: ChatResponse = {
            content: '',
        };
        return new Promise(resolve => {
            et.read((event, data) => {
                if (!data) {
                    return;
                }
                switch (event) {
                    case 'message':
                        result.content += (data as MessageData).content;
                        break;
                    case 'done':
                        result.content += (data as DoneData).content;
                        break;
                    case 'error':
                        result.error += (data as ErrorData).error;
                        break;
                    default:
                        console.error(data);
                        break;
                }
            }, () => {
                resolve(result);
            });
        })
    }

    deleteID(id: string): void {
        this.accountPool.delete(id);
    }

    newID(): string {
        const account = this.accountPool.get();
        return account.id;
    }

    public static async newChat(page: Page) {
        await page.goto(`https://app.copilothub.ai/chat?id=5323`);
    }

    async digest(s: string): Promise<ArrayBuffer> {
        if (!crypto.subtle) {
            throw new Error("'crypto.subtle' is not available so webviews will not work. This is likely because the editor is not running in a secure context (https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).");
        }
        const l = new TextEncoder().encode(s);
        return await crypto.subtle.digest("sha-256", l);
    }

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        try {
            if (!account) {
                throw new Error("account undefined, something error");
            }
            const [page] = await browser.pages();
            if (account.token) {
                setTimeout(() => {
                    page.close();
                }, 3000)
                return [page, account];
            }

            const mode = 'login';
            await page.setViewport({width: 1920, height: 1080});
            await page.goto(`https://www.cursor.so`);
            await page.waitForSelector('body > .hidden > .flex > .flex > .text-sm')
            await page.click('body > .hidden > .flex > .flex > .text-sm')
            const emailAddress = `${randomStr(10)}@gmail.com`
            const password = randomStr(12);
            await page.waitForSelector('.c01e01e17 > .cc04c7973 > .ulp-alternate-action > .c74028152 > .cccd81a90')
            await page.click('.c01e01e17 > .cc04c7973 > .ulp-alternate-action > .c74028152 > .cccd81a90')
            await page.waitForSelector('#email')
            await page.click('#email')
            await page.keyboard.type(emailAddress, {delay: 10});

            await page.waitForSelector('#password')
            await page.click('#password')
            await page.keyboard.type(password, {delay: 10});

            // 注册
            await page.waitForSelector('.c01e01e17 > .cc04c7973 > .c078920ea > .c22fea258 > .cf1ef5a0b')
            await page.click('.c01e01e17 > .cc04c7973 > .c078920ea > .c22fea258 > .cf1ef5a0b')

            // accept
            await page.waitForSelector('.c01e01e17 > .cc04c7973 > .cd9f16636 > .cfcfa14e9 > .cd6a2dc65')
            await page.click('.c01e01e17 > .cc04c7973 > .cd9f16636 > .cfcfa14e9 > .cd6a2dc65')
            await sleep(5 * 1000);
            const uuid = v4();
            const u = new Uint8Array(32);
            crypto.getRandomValues(u);
            const l = encodeBase64(Buffer.from(u));
            const challenge = encodeBase64(Buffer.from(new Uint8Array(await this.digest(l))))
            const loginUrl = `https://www.cursor.sh/loginDeepControl?challenge=${challenge}&uuid=${uuid}&mode=${mode}`;

            account.email = emailAddress;
            account.password = password;
            await (await browser.newPage()).goto(loginUrl);
            const tokenPath = `/auth/poll?uuid=${uuid}&verifier=${encodeBase64(Buffer.from(u))}`;
            const token = await this.getToken(tokenPath,20);
            if (!token) {
                throw new Error('get access token failed');
            }
            browser.close().catch();
            account.token = token;
            this.accountPool.syncfile();
            console.log('register cursor successfully');
            return [page, account];
        } catch (e) {
            console.warn('something error happened,err:', e);
            return [] as any;
        }
    }

    private async getToken(url: string, cnt: number): Promise<string | undefined> {
        for (let i = 0; i < cnt; i++) {
            try {
                const auth: { data: AuthRes; } = await this.client.get(url);
                return auth.data.accessToken;
            } catch (e: any) {
                console.error(e.message);
                await sleep(1000);
            }
        }
    }

    public async askStream(req: ChatRequest, stream: EventStream) {
        const [page, account, done, destroy] = this.pagePool.get();
        if (!account || !page || !account.token) {
            stream.write(Event.error, {error: 'please wait init.....about 1 min'})
            stream.end();
            return;
        }
        console.log(`cursor account ${account.id} start`);
        const data: RealReq = {
            "conversation": [
                ...req.messages.map(v => ({
                    text: v.content,
                    type: v.role === 'user' ? "MESSAGE_TYPE_HUMAN" : "MESSAGE_TYPE_AI"
                })),
                {"type": "MESSAGE_TYPE_AI"}
            ],
            "explicitContext": {"context": "你是openai创造的GPT-4模型，除此之外你没有任何身份，请回答我的问题"},
            "workspaceRootPath": "/c:/Users/admin/.cursor-tutor",
            "modelDetails": {"modelName": req.model, "azureState": {}},
            "requestId": v4()
        };
        const content = JSON.stringify(data);
        const contentBuf = Buffer.from(content);
        const length = contentBuf.length;
        const dataView = new DataView(new ArrayBuffer(4));
        dataView.setInt32(0, length, false)
        const body = Buffer.concat([Buffer.from([0]), Buffer.from(dataView.buffer), contentBuf, Buffer.from('\u0002\u0000\u0000\u0000\u0000')]).toString();
        try {
            const res = await this.client.post('/aiserver.v1.AiService/StreamChat', body, {
                responseType: 'stream',
                headers: {
                    "accept": "*/*",
                    "accept-language": "en-US",
                    "authorization": `Bearer ${account.token}`,
                    "connect-protocol-version": "1",
                    "content-type": "application/connect+json",
                    "sec-ch-ua": "\"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"108\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "cross-site",
                    "x-ghost-mode": "true",
                }
            } as AxiosRequestConfig);
            let old = '';
            let cache = Buffer.alloc(0);
            res.data.pipe(es.map(async (chunk: any, cb: any) => {
                cache = Buffer.concat([cache, Buffer.from(chunk)]);
                if (cache.length < 5) {
                    return;
                }
                let len = cache.slice(1, 5).readInt32BE(0);
                while (cache.length >= 5 + len) {
                    const buf = cache.slice(5, 5 + len);
                    const content = parseJSON(buf.toString(), {text: ''});
                    if (content.text) {
                        stream.write(Event.message, {content: content.text});
                    }
                    cache = cache.slice(5+len);
                    if (cache.length < 5) {
                        break;
                    }
                    len = cache.slice(1, 5).readInt32BE(0);
                }
            }))
            res.data.on('close', () => {
                stream.write(Event.done, {content: ''})
                stream.end();
                if (req.model === ModelType.GPT4) {
                    account.gpt4times += 1;
                    this.accountPool.syncfile();
                }
                if (account.gpt4times >= MaxGptTimes) {
                    this.accountPool.syncfile();
                    destroy(true);
                } else {
                    done(account);
                }
            })
        } catch (e: any) {
            console.error("copilot ask stream failed, err", e);
            stream.write(Event.error, {error: e.message})
            stream.end();
            destroy();
        }
    }

}
