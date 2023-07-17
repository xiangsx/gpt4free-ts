import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, EventEmitter, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {
    DoneData,
    ErrorData,
    Event,
    EventStream,
    isSimilarity,
    MessageData,
    parseJSON,
    shuffleArray,
    sleep
} from "../../utils";
import {v4} from "uuid";
import fs from "fs";

const ModelMap: Partial<Record<ModelType, any>> = {
    [ModelType.GPT4]: 'GPT-4',
    [ModelType.Sage]: 'Sage',
    [ModelType.Claude]: 'Claude+',
    [ModelType.Claude100k]: 'Claude-instant-100k+',
    [ModelType.ClaudeInstance]: 'Claude-instant',
    [ModelType.GPT3p5Turbo]: 'ChatGPT',
    [ModelType.GPT3p5_16k]: 'ChatGPT-16k',
    [ModelType.Gpt4free]: '1GPT4Free',
    [ModelType.GooglePalm]: 'Google-PaLM',
    [ModelType.Claude2_100k]: 'Claude-2-100k',
    [ModelType.GPT4_32k]: 'GPT-4-32K',
}

const MaxGptTimes = 500;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    pb: string;
    failedCnt: number;
    invalid?: boolean;
}

type HistoryData = {
    data: {
        query: string;
        result: string;
        created_at: string;
    }[]
}

interface Messages {
    id: string;
    messageId: number;
    creationTime: number;
    clientNonce: null;
    state: string;
    text: string;
    author: string;
    linkifiedText: string;
    contentType: string;
    attachments: any[];
    vote: null;
    suggestedReplies: string[];
    linkifiedTextLengthOnCancellation: null;
    textLengthOnCancellation: null;
    voteReason: null;
    __isNode: string;
}

interface Data {
    messageAdded: Messages;
}

interface Payload {
    unique_id: string;
    subscription_name: string;
    data: Data;
}

interface RootObject {
    message_type: string;
    payload: Payload;
}

interface RealAck {
    messages: string[];
    min_seq: number;
}

class PoeAccountPool {
    private pool: Record<string, Account> = {};
    private using = new Set<string>();
    private readonly account_file_path = './run/account_poe.json';

    constructor() {
        const pbList = (process.env.POE_PB || '').split('|');
        if (fs.existsSync(this.account_file_path)) {
            const accountStr = fs.readFileSync(this.account_file_path, 'utf-8');
            this.pool = parseJSON(accountStr, {} as Record<string, Account>);
        } else {
            fs.mkdirSync('./run', {recursive: true});
            this.syncfile();
        }
        for (const pb of pbList) {
            if (this.pool[pb]) {
                continue;
            }
            this.pool[pb] = {
                id: v4(),
                pb,
                failedCnt: 0,
                invalid: false,
            };
        }
        console.log(`read poe account total:${Object.keys(this.pool).length}`)
        this.syncfile();
    }

    public syncfile() {
        fs.writeFileSync(this.account_file_path, JSON.stringify(this.pool));
    }

    public getByID(id: string) {
        for (const item in this.pool) {
            if (this.pool[item].id === id) {
                return this.pool[item];
            }
        }
    }

    public delete(id: string) {
        for (const v in this.pool) {
            const vv = this.pool[v];
        }
        this.using.delete(id);
        this.syncfile();
    }

    public get(): Account {
        for (const v of shuffleArray(Object.keys(this.pool))) {
            const vv = this.pool[v];
            if (!vv.invalid && !this.using.has(vv.id)) {
                this.using.add(vv.id);
                return vv;
            }
        }
        console.log('poe pb run out!!!!!!');
        return {
            id: v4(),
            pb: '',
            failedCnt: 0,
        } as Account
    }
}


export class Poe extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private accountPool: PoeAccountPool;

    constructor(options?: ChatOptions) {
        super(options);
        this.accountPool = new PoeAccountPool();
        this.pagePool = new BrowserPool<Account>(+(process.env.POE_POOL_SIZE || 0), this, false);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.ClaudeInstance:
                return 4000;
            case ModelType.Claude100k:
                return 50000;
            case ModelType.Claude:
                return 4000;
            case ModelType.GPT4:
                return 6000;
            case ModelType.GPT3p5Turbo:
                return 3000;
            case ModelType.GPT3p5_16k:
                return 15000;
            case ModelType.Gpt4free:
                return 4000;
            case ModelType.Sage:
                return 4000;
            case ModelType.GooglePalm:
                return 4000;
            case ModelType.GPT4_32k:
                return 28000;
            case ModelType.Claude2_100k:
                return 80000
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

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        if (!account) {
            await sleep(10 * 24 * 60 * 60 * 1000);
            return [] as any;
        }
        const [page] = await browser.pages();
        try {
            await page.setCookie({name: 'p-b', value: account.pb, domain: 'poe.com'});
            await page.goto(`https://poe.com/GPT-4-32K`)
            await page.waitForSelector(Poe.InputSelector, {timeout: 30 * 1000, visible: true});
            await page.click(Poe.InputSelector);
            await page.type(Poe.InputSelector, `1`);
            const isVip = await Poe.isVIP(page);
            if (!isVip) {
                account.invalid = true;
                this.accountPool.syncfile();
                throw new Error(`account:${account?.pb}, not vip`);
            }
            if (!(await Poe.isLogin(page))) {
                account.invalid = true;
                this.accountPool.syncfile();
                throw new Error(`account:${account?.pb}, no login status`);
            }
            console.log(`poe init ok!`);
            return [page, account];
        } catch (e) {
            account.failedCnt += 1;
            this.accountPool.syncfile();
            console.warn(`account:${account?.pb}, something error happened,err:`, e);
            return [] as any;
        }
    }

    public static async isVIP(page: Page) {
        try {
            await page.waitForSelector(Poe.FreeModal, {timeout: 10 * 1000});
            return false;
        } catch (e) {
            return true;
        }
    }

    public static async isLogin(page: Page) {
        try {
            await page.waitForSelector(Poe.TalkToGpt, {timeout: 10 * 1000});
            return false;
        } catch (e) {
            return true;
        }
    }

    public static async clear(page: Page) {
        await page.waitForSelector('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content', {timeout: 10 * 60 * 1000});
        await page.click('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content')
    }

    public static InputSelector = '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .ChatMessageInputContainer_inputContainer__SQvPA > .GrowingTextArea_growWrap___1PZM > .GrowingTextArea_textArea__eadlu';
    public static ClearSelector = '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .Button_buttonBase__0QP_m > svg > path';
    public static FreeModal = ".ReactModal__Body--open > .ReactModalPortal > .ReactModal__Overlay > .ReactModal__Content";
    public static TalkToGpt = "body > #__next > .LoggedOutBotInfoPage_layout__Y_z0i > .LoggedOutBotInfoPage_botInfo__r2z3X > .LoggedOutBotInfoPage_appButton__UO6NU";

    public async askStream(req: ChatRequest, stream: EventStream) {
        // req.prompt = req.prompt.replace(/\n/g, ' ');
        const [page, account, done,
            destroy] = this.pagePool.get();
        if (page?.url().indexOf(ModelMap[req.model]) === -1) {
            await page?.goto(`https://poe.com/${ModelMap[req.model]}`, {waitUntil: 'networkidle0'});
        }
        if (!account || !page) {
            stream.write(Event.error, {error: 'please retry later!'});
            stream.write(Event.done, {content: ''})
            stream.end();
            return;
        }
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');
        try {
            let old = '';
            let et: EventEmitter;
            const tt = setTimeout(async () => {
                client.removeAllListeners('Network.webSocketFrameReceived');
                await page.waitForSelector(Poe.ClearSelector);
                await page.click(Poe.ClearSelector);
                account.failedCnt += 1;
                this.accountPool.syncfile();
                if (account.failedCnt >= 10) {
                    destroy(true);
                    account.invalid = true;
                    this.accountPool.syncfile();
                    console.log(`poe account failed cnt > 20, destroy ok`);
                } else {
                    await page.reload();
                    done(account);
                }
                if (!stream.stream().writableEnded && !stream.stream().closed) {
                    console.error('poe wait ack ws timeout, retry!');
                    await this.askStream(req, stream);
                }
            }, 10 * 1000);
            let currMsgID = '';
            et = client.on('Network.webSocketFrameReceived', async ({response}) => {
                tt.refresh();
                const data = parseJSON(response.payloadData, {} as RealAck);
                const obj = parseJSON(data.messages[0], {} as RootObject);
                const {unique_id} = obj.payload || {};
                const message = obj?.payload?.data?.messageAdded;
                if (!message) {
                    return;
                }
                const {author, state, text} = message;
                // console.log(author, state, text, unique_id);

                if (author === 'chat_break') {
                    return;
                }
                if (author === 'human' && isSimilarity(text, req.prompt)) {
                    currMsgID = unique_id;
                    return;
                }
                if (unique_id !== currMsgID) {
                    // console.log(`message id different`, {unique_id, currMsgID});
                    return;
                }
                switch (state) {
                    case 'complete':
                        clearTimeout(tt);
                        client.removeAllListeners('Network.webSocketFrameReceived');
                        stream.write(Event.message, {content: text.substring(old.length)});
                        stream.write(Event.done, {content: ''});
                        stream.end();
                        await page.waitForSelector(Poe.ClearSelector);
                        await page.click(Poe.ClearSelector);
                        account.failedCnt = 0;
                        this.accountPool.syncfile();
                        done(account);
                        console.log('poe recv msg complete')
                        return;
                    case 'incomplete':
                        stream.write(Event.message, {content: text.substring(old.length)});
                        old = text;
                        return;
                }
            })
            console.log('poe start send msg');
            await page.waitForSelector(Poe.ClearSelector);
            await page.click(Poe.ClearSelector);
            await page.waitForSelector(Poe.InputSelector)
            await page.click(Poe.InputSelector);
            await page.type(Poe.InputSelector, `1`);
            console.log('poe find input ok');
            const input = await page.$(Poe.InputSelector);
            //@ts-ignore
            await input?.evaluate((el, content) => el.value = content, req.prompt);
            await page.keyboard.press('Enter');
            console.log('send msg ok!');
        } catch (e) {
            client.removeAllListeners('Network.webSocketFrameReceived');
            console.error(`account: pb=${account.pb}, poe ask stream failed:`, e);
            account.failedCnt += 1;
            this.accountPool.syncfile();
            done(account);
            stream.write(Event.error, {error: 'some thing error, try again later'});
            stream.write(Event.done, {content: ''})
            stream.end();
            return
        }
    }
}
