import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, EventEmitter, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {DoneData, ErrorData, Event, EventStream, extractStrNumber, MessageData, parseJSON, sleep} from "../../utils";
import {v4} from "uuid";
import fs from "fs";

const ModelMap: Partial<Record<ModelType, any>> = {
    [ModelType.GPT4]: 'GPT-4',
    [ModelType.GPT3p5Turbo]: 'ChatGPT',
}


const MaxFailedTimes = 10;

type UseLeft = Partial<Record<ModelType, number>>;

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    cookie: string;
    failedCnt: number;
    invalid?: boolean;
    use_left?: UseLeft;
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

class AccountPool {
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
        for (const key in this.pool) {
            this.pool[key].failedCnt = 0;
        }
        for (const pb of pbList) {
            if (this.pool[pb]) {
                continue;
            }
            this.pool[pb] = {
                id: v4(),
                cookie: pb,
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
        for (const vv of Object.values(this.pool).sort((a, b) => (b.use_left?.[ModelType.GPT4] || 0) - (a.use_left?.[ModelType.GPT4] || 0))) {
            if (!vv.invalid && !this.using.has(vv.id)) {
                if (vv.use_left && vv.use_left[ModelType.GPT4] === 0 && vv.use_left[ModelType.GPT4_32k] === 0) {
                    vv.invalid = true;
                    continue;
                }
                this.using.add(vv.id);
                vv.failedCnt = 0;
                return vv;
            }
        }
        console.log('poe pb run out!!!!!!');
        return {
            id: v4(),
            cookie: '',
            failedCnt: 0,
        } as Account
    }
}

interface PerplexityChatRequest extends ChatRequest {
    retry?: number;
}

export class Perplexity extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private accountPool: AccountPool;

    constructor(options?: ChatOptions) {
        super(options);
        this.accountPool = new AccountPool();
        this.pagePool = new BrowserPool<Account>(+(process.env.PERPLEXITY_POOL_SIZE || 0), this, false, undefined, true);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT4:
                return 4500;
            case ModelType.GPT3p5Turbo:
                return 3000;
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


    public static SelectorGpt4Left = '.SettingsSubscriptionSection_sectionBubble__nlU_b:nth-child(3) > .SettingsSubscriptionSection_countsSection__48sVJ > .SettingsSubscriptionSection_countRowContainer__ZJ419:nth-child(2) > .SettingsSubscriptionSection_countRow__GMItW > .SettingsSubscriptionSection_subtitle__Z7mcW:nth-child(2)';
    public static SelectorGpt4_32kLeft = '.SettingsSubscriptionSection_sectionBubble__nlU_b:nth-child(4) > .SettingsSubscriptionSection_countsSection__48sVJ > .SettingsSubscriptionSection_countRowContainer__ZJ419 > .SettingsSubscriptionSection_countRow__GMItW > .SettingsSubscriptionSection_subtitle__Z7mcW:nth-child(2)';
    public static SelectorGpt3_16kLeft = '.SettingsSubscriptionSection_sectionBubble__nlU_b:nth-child(5) > .SettingsSubscriptionSection_countsSection__48sVJ > .SettingsSubscriptionSection_countRowContainer__ZJ419 > .SettingsSubscriptionSection_countRow__GMItW > .SettingsSubscriptionSection_subtitle__Z7mcW:nth-child(2)';
    public static SelectorClaude2_100k = '.SettingsSubscriptionSection_sectionBubble__nlU_b:nth-child(1) > .SettingsSubscriptionSection_countsSection__48sVJ > .SettingsSubscriptionSection_countRowContainer__ZJ419:nth-child(2) > .SettingsSubscriptionSection_countRow__GMItW > .SettingsSubscriptionSection_subtitle__Z7mcW:nth-child(2)';

    public static async getUseLeft(page: Page): Promise<UseLeft> {
        await page.goto("https://poe.com/settings");
        return {
            [ModelType.GPT4]: await Perplexity.getSelectorCnt(page, Perplexity.SelectorGpt4Left),
            [ModelType.GPT4_32k]: await Perplexity.getSelectorCnt(page, Perplexity.SelectorGpt4_32kLeft),
            [ModelType.GPT3p5_16k]: await Perplexity.getSelectorCnt(page, Perplexity.SelectorGpt3_16kLeft),
            [ModelType.Claude2_100k]: await Perplexity.getSelectorCnt(page, Perplexity.SelectorClaude2_100k),
        };
    }

    public static async getSelectorCnt(page: Page, selector: string): Promise<number> {
        const v: string = await page.evaluate((arg1) => document.querySelector(arg1)?.textContent || '', selector);
        return extractStrNumber(v);
    }

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        if (!account) {
            await sleep(10 * 24 * 60 * 60 * 1000);
            return [] as any;
        }
        const page = await browser.newPage();
        try {
            await page.setCookie({
                url: 'https://www.perplexity.ai',
                name: '__Secure-next-auth.session-token',
                value: 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..2Jh-oW3mm8SJjhuN.HpihIhmTs76MBRSQMJMVJ5W5HS9NWI2niEfhUxdqAbLetNUxsmsNG94fd_mBwXP2EqIHDI6pGpAr9mEjcIa0fgI5_8Iy89QIJHV_Mqq9azfahJWZxo84YlO7M5o3VnlNTMoauOOClslqitObZ-I_8kfM3eg_GwEESLQlgT5Cl2eq-f26bj4O9CAATBk-15N18-i7RTBpvdPwcv856hKs.M3Ny8CUWXOQjwK0W4_wlig'
            });
            await page.goto(`https://perplexity.ai`)
            if (!(await Perplexity.isLogin(page))) {
                account.invalid = true;
                this.accountPool.syncfile();
                throw new Error(`account:${account?.cookie}, no login status`);
            }
            await page.waitForSelector(Perplexity.InputSelector, {timeout: 30 * 1000, visible: true});
            await page.waitForSelector('.absolute > div > div > .md\\:hover\\:bg-offsetPlus > .flex > .flex')
            await page.click('.absolute > div > div > .md\\:hover\\:bg-offsetPlus > .flex > .flex')

            await page.waitForSelector('.animate-in > .md\\:h-full:nth-child(3) > .md\\:h-full > .relative > .mt-one')
            await page.click('.animate-in > .md\\:h-full:nth-child(3) > .md\\:h-full > .relative > .mt-one')
            this.accountPool.syncfile();
            console.log(`perp init ok! ${account.cookie}`);
            return [page, account];
        } catch (e:any) {
            account.failedCnt += 1;
            this.accountPool.syncfile();
            console.warn(`account:${account?.cookie}, something error happened.`, e);
            return [] as any;
        }
    }

    public static async isVIP(page: Page) {
        try {
            await page.waitForSelector(Perplexity.FreeModal, {timeout: 5 * 1000});
            return false;
        } catch (e:any) {
            return true;
        }
    }

    public static async isLogin(page: Page) {
        try {
            await page.waitForSelector(Perplexity.UserName, {timeout: 5 * 1000});
            return true;
        } catch (e:any) {
            return false;
        }
    }

    public static InputSelector = '.grow > div > .rounded-full > .relative > .outline-none';
    public static NewThread = '.grow > .my-md > div > .border > .text-clip';
    public static FreeModal = ".ReactModal__Body--open > .ReactModalPortal > .ReactModal__Overlay > .ReactModal__Content";
    public static UserName = ".px-sm > .flex > div > .flex > .line-clamp-1";

    public static async newThread(page: Page) {
        await page.waitForSelector(Perplexity.NewThread, {timeout: 10 * 60 * 1000});
        await page.click(Perplexity.NewThread);
    }

    public async askStream(req: PerplexityChatRequest, stream: EventStream) {
        const [page, account, done,
            destroy] = this.pagePool.get();
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
                await Perplexity.newThread(page);
                await sleep(2000);
                account.failedCnt += 1;
                this.accountPool.syncfile();
                if (account.failedCnt >= MaxFailedTimes) {
                    destroy(true);
                    this.accountPool.syncfile();
                    console.log(`poe account failed cnt > 10, destroy ok`);
                } else {
                    await page.reload();
                    done(account);
                }
                if (!stream.stream().writableEnded && !stream.stream().closed) {
                    if ((req?.retry || 0) > 3) {
                        console.log('poe try times > 3, return error');
                        stream.write(Event.error, {error: 'please retry later!'});
                        stream.write(Event.done, {content: ''})
                        stream.end();
                        return;
                    }
                    console.error(`pb ${account.cookie} wait ack ws timeout, retry! failedCnt:${account.failedCnt}`);
                    req.retry = req.retry ? req.retry + 1 : 1;
                    await this.askStream(req, stream);
                }
            }, 20 * 1000);
            let currMsgID = '';
            et = client.on('Network.webSocketFrameReceived', async ({response}) => {
                tt.refresh();
                const dataStr = response.payloadData.replace(/^(\d+(\.\d+)?)/, '');
                const data = parseJSON(dataStr, []);
                if (data.length !== 2) {
                    return;
                }
                const [ansType, ansObj] = data;
                const text = (ansObj as any).text;
                const textObj = parseJSON<{ answer: string; web_results: any[] }>(text, {
                    answer: '',
                    web_results: []
                });
                switch (ansType) {
                    case 'query_answered':
                        clearTimeout(tt);
                        client.removeAllListeners('Network.webSocketFrameReceived');
                        if (text.length > old.length) {
                            stream.write(Event.message, {content: textObj.answer.substring(old.length)});
                        }
                        stream.write(Event.done, {content: ''});
                        stream.end();
                        done(account);
                        console.log('perplexity recv msg complete');
                        break;
                    case 'query_progress':
                        if (textObj.answer.length > old.length) {
                            stream.write(Event.message, {content: textObj.answer.substring(old.length)});
                            old = textObj.answer;
                        }

                }
            })
            console.log('poe start send msg');
            await Perplexity.newThread(page);

            await page.waitForSelector('.relative > .grow > div > .rounded-full > .relative > .outline-none')
            await page.click('.relative > .grow > div > .rounded-full > .relative > .outline-none')
            await page.keyboard.type(req.prompt.replace(/\n/g, ''), {delay: 0});

            await page.waitForSelector('.absolute > .bg-green > .bg-super > .flex > .svg-inline--fa')
            await page.click('.absolute > .bg-green > .bg-super > .flex > .svg-inline--fa')
            console.log('perplexity find input ok');
            // const input = await page.$(Perplexity.InputSelector);
            //@ts-ignore
            // await input?.evaluate((el, content) => el.value = content, req.prompt);
            await page.keyboard.press('Enter');
            console.log('send msg ok!');
        } catch (e:any) {
            client.removeAllListeners('Network.webSocketFrameReceived');
            console.error(`account: pb=${account.cookie}, poe ask stream failed:`, e);
            account.failedCnt += 1;
            if (account.failedCnt >= MaxFailedTimes) {
                destroy(true);
                this.accountPool.syncfile();
                console.log(`poe account failed cnt > 10, destroy ok`);
            } else {
                this.accountPool.syncfile();
                await page.reload();
                done(account);
            }
            done(account);
            stream.write(Event.error, {error: 'some thing error, try again later'});
            stream.write(Event.done, {content: ''})
            stream.end();
            return
        }
    }
}
