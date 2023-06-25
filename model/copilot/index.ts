import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {CreateEmail, TempEmailType, TempMailMessage} from "../../utils/emailFactory";
import * as fs from "fs";
import {
    DoneData,
    ErrorData,
    Event,
    EventStream,
    htmlToMarkdown,
    isSimilarity,
    MessageData,
    parseJSON,
    sleep
} from "../../utils";
import {v4} from "uuid";
import moment from 'moment';
import TurndownService from 'turndown';

const turndownService = new TurndownService({codeBlockStyle: 'fenced'});

type PageData = {
    gpt4times: number;
}

const MaxGptTimes = 500;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    gpt4times: number;
}

type HistoryData = {
    data: {
        query: string;
        result: string;
        created_at: string;
    }[]
}

class CopilotAccountPool {
    private pool: Account[] = [];
    private readonly account_file_path = './run/account_copilot.json';
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
            if (item.gpt4times + 15 <= MaxGptTimes && !this.using.has(item.id)) {
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

interface CopilotOptions extends ChatOptions {
    model: ModelType;
}


export class Copilot extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private accountPool: CopilotAccountPool;
    private readonly model: ModelType;

    constructor(options?: CopilotOptions) {
        super(options);
        this.model = options?.model || ModelType.GPT4;
        this.accountPool = new CopilotAccountPool();
        let maxSize = +(process.env.COPILOT_POOL_SIZE || 0);
        this.pagePool = new BrowserPool<Account>(maxSize, this);
    }

    support(model: ModelType): number {
        switch (model) {
            case this.model:
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
                        result.content = (data as MessageData).content;
                        break;
                    case 'done':
                        result.content = (data as DoneData).content;
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
            await page.waitForSelector('div > div > button > .semi-typography > strong', {timeout: 10 * 1000})
            await page.click('div > div > button > .semi-typography > strong')
        } catch (e) {
            console.log('not need close welcome pop');
        }
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

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        try {
            if (!account) {
                throw new Error("account undefined, something error");
            }
            const [page] = await browser.pages();
            await page.setViewport({width: 1920, height: 1080});
            await Copilot.newChat(page);
            if (await Copilot.ifLogin(page)) {
                return [page, account];
            }
            await page.goto("https://app.copilothub.ai/login");
            await page.waitForSelector('div > .login-wrapper > .login-form-container > .semi-input-wrapper > .semi-input')
            await page.click('div > .login-wrapper > .login-form-container > .semi-input-wrapper > .semi-input')

            const emailBox = CreateEmail(process.env.EMAIL_TYPE as TempEmailType || TempEmailType.TempEmail44)
            const emailAddress = await emailBox.getMailAddress();
            account.email = emailAddress;
            account.gpt4times = 0;
            this.accountPool.syncfile();
            // 将文本键入焦点元素
            await page.keyboard.type(emailAddress, {delay: 10});

            await page.waitForSelector('.login-wrapper > .login-form-container > .semi-button > .semi-button-content > .semi-button-content-left')
            await page.click('.login-wrapper > .login-form-container > .semi-button > .semi-button-content > .semi-button-content-left')

            const msgs = (await emailBox.waitMails()) as TempMailMessage[]
            let validateURL: string | undefined;
            for (const msg of msgs) {
                validateURL = msg.content.match(/https:\/\/fjebjed[^"]*/i)?.[0];
                if (validateURL) {
                    break;
                }
            }
            if (!validateURL) {
                throw new Error('Error while obtaining verfication URL!')
            }
            await page.goto(validateURL);
            account.login_time = moment().format(TimeFormat);
            account.gpt4times = 0;
            this.accountPool.syncfile();
            await Copilot.closeWelcomePop(page);
            await Copilot.newChat(page);
            console.log('register copilot successfully');
            return [page, account];
        } catch (e) {
            console.warn('something error happened,err:', e);
            return [] as any;
        }
    }

    public static async ifLogin(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('.app > .header > .header-right > .semi-avatar > img', {timeout: 10 * 1000})
            await page.click('.app > .header > .header-right > .semi-avatar > img')
            console.log('still login in');
            return true;
        } catch (e) {
            return false;
        }
    }

    public static async clear(page: Page) {
        await page.waitForSelector('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content', {timeout: 10 * 60 * 1000});
        await page.click('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content')
    }

    public async askStream(req: ChatRequest, stream: EventStream) {
        req.prompt = req.prompt.replace(/\n/g, '|');
        const [page, account, done, destroy] = this.pagePool.get();
        if (!account || !page) {
            stream.write(Event.error, {error: 'please wait init.....about 1 min'})
            stream.end();
            return;
        }
        try {
            console.log('try to find input');
            await page.waitForSelector('.ChatFooter > .Composer > .Composer-inputWrap > div > .Input', {
                timeout: 10000,
                visible: true
            })
            await page.click('.ChatFooter > .Composer > .Composer-inputWrap > div > .Input')
            console.log('found input');
            await page.focus('.ChatFooter > .Composer > .Composer-inputWrap > div > .Input')
            await page.keyboard.type(req.prompt);
            await page.keyboard.press('Enter');
        } catch (e) {
            console.error(e);
            destroy();
            stream.write(Event.error, {error: 'some thing error, try again later'});
            stream.end();
            return
        }

        // get latest markdown id
        (async () => {
            let itl;
            try {
                //@ts-ignore
                const length: number = await page.evaluate(() => document.querySelector(".MessageContainer > .PullToRefresh > .PullToRefresh-inner > .PullToRefresh-content > .MessageList").children.length)
                const selector = `.Message:nth-child(${length}) > .Message-main > .Message-inner > .Message-content > .Bubble`;
                await page.waitForSelector(selector, {timeout: 120 * 1000});
                itl = setInterval(async () => {
                    const result = await page.$(selector)
                    const text: any = await result?.evaluate(el => {
                        return el.outerHTML;
                    });
                    if (text) {
                        stream.write(Event.message, {content: htmlToMarkdown(text)})
                    }
                }, 100)
                if (!page) {
                    return;
                }
                await page.waitForSelector('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content', {timeout: 10 * 60 * 1000});
                if (itl) {
                    clearInterval(itl);
                }
                //@ts-ignore
                const result = await page.$(selector)
                let sourceText: any = await result?.evaluate(el => {
                    return el.outerHTML;
                })
                page.reload().then();
                const finalResponse = await page.waitForResponse(
                    response =>
                        response.url() === 'https://api.pipe3.xyz/api/v1/copilothub/copilot/history?copilot_id=5323' && response.status() === 200
                );
                const finalRes = parseJSON<HistoryData>(await finalResponse.text(), {data: []});
                const finalText = finalRes.data[finalRes.data.length - 1].result || '';
                console.log('chat end: ', finalText);
                sourceText = htmlToMarkdown(sourceText);
                if (isSimilarity(finalText, sourceText)) {
                    stream.write(Event.done, {content: finalText});
                    stream.end();
                } else {
                    stream.write(Event.done, {content: sourceText});
                    stream.end();
                }
                await Copilot.clear(page);
                account.gpt4times += 15;
                account.last_use_time = moment().format(TimeFormat);
                this.accountPool.syncfile();
                if (account.gpt4times + 15 > MaxGptTimes) {
                    this.accountPool.syncfile();
                    destroy(true);
                } else {
                    done(account);
                }
            } catch (e) {
                console.error(e);
                account.gpt4times = 0;
                account.last_use_time = moment().format(TimeFormat);
                this.accountPool.syncfile();
                stream.end();
                destroy(true);
            }
        })().then().catch((e) => {
            console.error(e);
            stream.end();
            destroy();
        });
        return
    }

}
