import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, EventEmitter, Page} from "puppeteer";
import {BrowserPool, BrowserUser, closeOtherPages, PrepareOptions} from "../../pool/puppeteer";
import {DoneData, ErrorData, Event, EventStream, MessageData, parseJSON, shuffleArray, sleep} from "../../utils";
import {v4} from "uuid";
import fs from "fs";

const MaxFailedTimes = 10;

type UseLeft = Partial<Record<ModelType, number>>;

const ModelMap: Partial<Record<ModelType, string>> = {
    [ModelType.NetGPT4]: '.md\\:h-full:nth-child(1) > .md\\:h-full > .relative > .flex > .flex > span',
    [ModelType.GPT4]: '.md\\:h-full:nth-child(3) > .md\\:h-full > .relative > .flex > .flex > span',
}

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    token: string;
    failedCnt: number;
    invalid?: boolean;
    use_left?: UseLeft;
}

class AccountPool {
    private readonly pool: Record<string, Account> = {};
    private using = new Set<string>();
    private readonly account_file_path = './run/account_perplexity.json';

    constructor() {
        const pbList = (process.env.PERPLEXITY_TOKEN || '').split('|');
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
                token: pb,
                failedCnt: 0,
                invalid: false,
            };
        }
        console.log(`read perplexity account total:${Object.keys(this.pool).length}`)
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
        for (const vv of shuffleArray(Object.values(this.pool))) {
            if (!vv.invalid && !this.using.has(vv.id)) {
                this.using.add(vv.id);
                vv.failedCnt = 0;
                return vv;
            }
        }
        console.log('perplexity pb run out!!!!!!');
        return {
            id: v4(),
            token: '',
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
        this.pagePool = new BrowserPool<Account>(+(process.env.PERPLEXITY_POOL_SIZE || 0), this, false, 20 * 1000, true);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT4:
                return 5500;
            case ModelType.NetGPT4:
                return 5500;
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


    async init(id: string, browser: Browser, options?: PrepareOptions): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        if (!account || !account.token) {
            await browser.close();
            await sleep(10 * 24 * 60 * 60 * 1000);
            return [] as any;
        }
        let page = await browser.newPage();
        try {
            await page.setCookie({
                url: 'https://www.perplexity.ai',
                name: '__Secure-next-auth.session-token',
                value: account.token
            });
            await page.goto(`https://www.perplexity.ai`)
            if (!options) {
                throw new Error('perplexity found no options');
            }
            let newB = await options.waitDisconnect(10 * 1000);
            page = await newB.newPage();
            await page.goto(`https://www.perplexity.ai`)
            await closeOtherPages(newB, page);

            if (!(await Perplexity.isLogin(page))) {
                account.invalid = true;
                this.accountPool.syncfile();
                throw new Error(`account:${account?.token}, no login status`);
            }
            await page.waitForSelector(Perplexity.InputSelector, {timeout: 30 * 1000, visible: true});
            await Perplexity.changeMode(page);
            await Perplexity.closeCopilot(page);
            this.accountPool.syncfile();
            console.log(`perplexity init ok! ${account.token}`);
            return [page, account];
        } catch (e:any) {
            account.failedCnt += 1;
            account.invalid = true;
            this.accountPool.syncfile();
            console.warn(`account:${account?.token}, something error happened.`, e);
            return [] as any;
        }
    }
    public static async isLogin(page: Page) {
        try {
            await page.waitForSelector(Perplexity.ProTag, {timeout: 5 * 1000});
            return true;
        } catch (e:any) {
            return false;
        }
    }
    public static InputSelector = '.grow > div > .rounded-full > .relative > .outline-none';
    public static NewThread = '.grow > .my-md > div > .border > .text-clip';
    public static UserName = ".px-sm > .flex > div > .flex > .line-clamp-1";
    public static ProTag = ".px-sm > .flex > div > .super > span";

    public static async goHome(page: Page) {
        await page.waitForSelector('.grow > .items-center > .relative:nth-child(1) > .px-sm > .md\\:hover\\:bg-offsetPlus')
        await page.click('.grow > .items-center > .relative:nth-child(1) > .px-sm > .md\\:hover\\:bg-offsetPlus')
    }

    public static async changeMode(page: Page, model: ModelType = ModelType.GPT4) {
        await page.waitForSelector('.absolute > .absolute > div > div > .md\\:hover\\:bg-offsetPlus')
        await page.click('.absolute > .absolute > div > div > .md\\:hover\\:bg-offsetPlus')

        const selector = ModelMap[model];
        if (selector) {
            await page.waitForSelector(selector);
            await page.click(selector)
        }
    }

    public static async closeCopilot(page: Page) {
        try {
            await page.waitForSelector('.text-super > .flex > div > .rounded-full > .relative', {timeout: 5 * 1000});
            await page.click('.text-super > .flex > div > .rounded-full > .relative');
        } catch (e) {
        }
    }

    public static async deleteThread(page: Page) {
        await page.waitForSelector('.-mr-xs > div > .md\\:hover\\:bg-offsetPlus > .flex > .svg-inline--fa')
        await page.click('.-mr-xs > div > .md\\:hover\\:bg-offsetPlus > .flex > .svg-inline--fa')

        await page.waitForSelector('.animate-in > .md\\:h-full > .md\\:h-full > .relative > .flex')
        await page.click('.animate-in > .md\\:h-full > .md\\:h-full > .relative > .flex')
    }

    public async askStream(req: PerplexityChatRequest, stream: EventStream) {
        if (req.model !== ModelType.NetGPT4) {
            req.prompt = "user: 你是谁 assistant: 我是openai开发的GPT4模型" + req.prompt;
        }
        req.prompt = req.prompt.replace(/\n/g, '');
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
                stream.write(Event.error, {error: 'please retry later!'});
                stream.write(Event.done, {content: ''});
                stream.end();
                account.failedCnt += 1;
                this.accountPool.syncfile();
                if (account.failedCnt >= MaxFailedTimes) {
                    destroy(false);
                    this.accountPool.syncfile();
                    console.log(`perplexity account failed cnt > 10, destroy ok`);
                } else {
                    await Perplexity.goHome(page);
                    await page.reload();
                    done(account);
                }
            }, 10 * 1000);
            let currMsgID = '';
            et = client.on('Network.webSocketFrameReceived', async ({response}) => {
                tt.refresh();
                const dataStr = response.payloadData.replace(/^(\d+(\.\d+)?)/, '');
                const data = parseJSON(dataStr, []);
                console.log(data);
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
                        await Perplexity.deleteThread(page);
                        await Perplexity.goHome(page);
                        if (text.length > old.length) {
                            stream.write(Event.message, {content: textObj.answer.substring(old.length)});
                        }
                        stream.write(Event.done, {content: ''});
                        stream.end();
                        done(account);
                        console.log('perplexity recv msg complete');
                        break;
                    case 'query_progress':
                        if (textObj.answer.length === 0 && req.model === ModelType.NetGPT4) {
                            stream.write(Event.search, {search: textObj.web_results});
                        }
                        if (textObj.answer.length > old.length) {
                            stream.write(Event.message, {content: textObj.answer.substring(old.length)});
                            old = textObj.answer;
                        }

                }
            })
            console.log('perplexity start send msg');
            await Perplexity.changeMode(page, req.model);

            await page.waitForSelector('.relative > .grow > div > .rounded-full > .relative > .outline-none')
            await page.click('.relative > .grow > div > .rounded-full > .relative > .outline-none')
            await page.keyboard.type(req.prompt, {delay: 0});

            console.log('perplexity find input ok');
            // const input = await page.$(Perplexity.InputSelector);
            //@ts-ignore
            // await input?.evaluate((el, content) => el.value = content, req.prompt);
            await page.keyboard.press('Enter');
            console.log('send msg ok!');
        } catch (e:any) {
            client.removeAllListeners('Network.webSocketFrameReceived');
            console.error(`account: pb=${account.token}, perplexity ask stream failed:`, e);
            await Perplexity.goHome(page);
            account.failedCnt += 1;
            if (account.failedCnt >= MaxFailedTimes) {
                destroy(false);
                this.accountPool.syncfile();
                console.log(`perplexity account failed cnt > 10, destroy ok`);
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
