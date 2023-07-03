import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {DoneData, ErrorData, Event, EventStream, MessageData, parseJSON, randomUserAgent} from "../../utils";
import TurndownService from 'turndown';
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import es from "event-stream";
import {v4} from "uuid";

const turndownService = new TurndownService({codeBlockStyle: 'fenced'});

type PageData = {
    gpt4times: number;
}

const MaxGptTimes = 3;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

interface Message {
    role: string;
    content: string;
}

interface RealReq {
    prompt: string;
}

type Account = {
    id: string;
    email?: string;
    password?: string;
    login_time?: string;
    last_use_time?: string;
    gpt4times: number;
    cookies?: string;
}

type HistoryData = {
    data: {
        query: string;
        result: string;
        created_at: string;
    }[]
}


export class Bai extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private client: AxiosInstance;
    private agent: string;

    constructor(options?: ChatOptions) {
        super(options);
        let maxSize = +(process.env.BaiPoolSize || 0);
        this.pagePool = new BrowserPool<any>(maxSize, this);
        this.agent = 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67';
        this.client = CreateAxiosProxy({
            baseURL: 'https://chatbot.theb.ai/api/',
            headers: {
                "Accept": "text/css,*/*;q=0.1",
                "User-Agent": this.agent,
                "Origin": "https://chatbot.theb.ai",
            }
        } as CreateAxiosDefaults)
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT3p5Turbo:
                return 0;
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
                        result.error = (data as ErrorData).error;
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

    private static async closeWelcomePop(page: Page) {
        try {
            await page.waitForSelector('.fixed > #radix-\\:r0\\: > .flex > .button_icon-button__BC_Ca > .button_icon-button-text__k3vob')
            await page.click('.fixed > #radix-\\:r0\\: > .flex > .button_icon-button__BC_Ca > .button_icon-button-text__k3vob')
        } catch (e) {
            console.log('not need close welcome pop');
        }
    }

    deleteID(id: string): void {

    }

    newID(): string {
        return v4();
    }

    async init(id: string, browser: Browser): Promise<[Page | undefined, any]> {
        try {
            const [page] = await browser.pages();
            await page.setUserAgent(this.agent);
            await page.goto("https://chatbot.theb.ai/#/chat/");
            console.log('Bai ready');
            return [page, {}];
        } catch (e) {
            console.warn('something error happened,err:', e);
            return [] as any;
        }
    }

    public async askStream(req: ChatRequest, stream: EventStream) {
        req.prompt = req.prompt.replace(/\n/g, ' ');
        const [page, account, done, destroy] = this.pagePool.get();
        if (!account || !page) {
            stream.write(Event.error, {error: 'please wait init.....about 1 min'})
            stream.end();
            return;
        }
        let model = 'gpt-4';
        switch (model) {
            case ModelType.GPT3p5Turbo:
                model = 'gpt-3.5-turbo';
                break;
        }
        const data: RealReq = {
            prompt: req.prompt,
        };
        try {
            const cookies = await page.cookies();
            const res = await this.client.post('/chat-process', data, {
                responseType: 'stream',
                headers: {
                    "Cookie": cookies.map(item => `${item.name}=${item.value}`).join(';'),
                },
            } as AxiosRequestConfig);
            let old = '';
            res.data.pipe(es.split(/\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                try {
                    const dataStr = chunk.toString();
                    const data = parseJSON(dataStr, {} as any);
                    const {delta = ''} = data;
                    if (!delta) {
                        return;
                    }
                    stream.write(Event.message, {content: delta});
                } catch (e) {
                    console.error(e);
                }
            }))
            res.data.on('close', () => {
                stream.write(Event.done, {content: ''});
                stream.end();
                console.log('easy chat close');
                done(account);
            })
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
            await page.reload();
            done(account);
        }

    }
}
