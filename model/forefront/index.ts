import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {CreateEmail, TempEmailType, TempMailMessage} from "../../utils/emailFactory";
import {CreateTlsProxy} from "../../utils/proxyAgent";
import * as fs from "fs";
import {DoneData, ErrorData, Event, EventStream, MessageData, parseJSON, sleep} from "../../utils";
import {v4} from "uuid";
import moment from 'moment';

type PageData = {
    gpt4times: number;
}

const MaxGptTimes = 4;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    gpt4times: number;
}

class AccountPool {
    private pool: Account[] = [];
    private readonly account_file_path = './run/account.json';

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
        const minInterval = 3 * 60 * 60 + 10 * 60;// 3hour + 10min
        for (const item of this.pool) {
            if (now.unix() - moment(item.last_use_time).unix() > minInterval) {
                console.log(`find old login account:`, item);
                item.last_use_time = now.format(TimeFormat);
                this.syncfile();
                return item
            }
        }
        const newAccount: Account = {
            id: v4(),
            last_use_time: now.format(TimeFormat),
            gpt4times: 0,
        }
        this.pool.push(newAccount);
        this.syncfile();
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

interface ForefrontOptions extends ChatOptions {
    model: ModelType;
}


export class Forefrontnew extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private accountPool: AccountPool;
    private readonly model: ModelType;

    constructor(options?: ForefrontOptions) {
        super(options);
        this.accountPool = new AccountPool();
        const maxSize = +(process.env.POOL_SIZE || 2);
        this.pagePool = new BrowserPool<Account>(maxSize, this);
        this.model = options?.model || ModelType.GPT4;
    }

    support(model: ModelType): number {
        switch (model) {
            case this.model:
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

    private async tryValidate(validateURL: string, triedTimes: number) {
        if (triedTimes === 10) {
            throw new Error('validate failed');
        }
        triedTimes += 1;
        try {
            const tsl = await CreateTlsProxy({clientIdentifier: "chrome_108"}).get(validateURL)
        } catch (e) {
            console.log(e)
            await this.tryValidate(validateURL, triedTimes);
        }
    }

    private static async closeVIPPop(page: Page) {
        try {
            await page.waitForSelector('.grid > .grid > .w-full > .border-t > .text-th-primary-medium', {timeout: 10 * 1000})
            await page.click('.grid > .grid > .w-full > .border-t > .text-th-primary-medium')
        } catch (e) {
            console.log('not need close vip');
        }
    }

    private static async closeWelcomePop(page: Page) {
        try {
            await page.waitForSelector('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)', {timeout: 30 * 1000})
            await page.click('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)')
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

    private static async selectAssistant(page: Page) {
        await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
        await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
        await page.hover('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
        // click assistant select
        await page.waitForSelector('.px-4 > .flex > .grid > .h-9 > .grow')
        await page.click('.px-4 > .flex > .grid > .h-9 > .grow')

        // focus search input
        await page.waitForSelector('.flex > .grid > .block > .sticky > .text-sm')
        await page.click('.flex > .grid > .block > .sticky > .text-sm')
        await page.keyboard.type('helpful', {delay: 10});

        // select helpful assistant
        await page.waitForSelector('.px-4 > .flex > .grid > .block > .group')
        await page.click('.px-4 > .flex > .grid > .block > .group')

        await page.click('.relative > .flex > .w-full > .text-th-primary-dark > div')
    }

    private async switch(page: Page) {
        switch (this.model) {
            case ModelType.GPT4:
                await Forefrontnew.switchToGpt4(page);
                break;
            case ModelType.ClaudeP:
                await Forefrontnew.switchToClaudeP(page);
                break;
            default:
                break;
        }
    }

    private static async switchToGpt4(page: Page, triedTimes: number = 0) {
        if (triedTimes === 3) {
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
            return;
        }
        try {
            console.log('switch gpt4....')
            triedTimes += 1;
            await sleep(1000);
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
            await sleep(1000);
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await sleep(1000);
            await page.hover('div > .absolute > .relative > .w-full:nth-child(3) > .relative')

            // click never internet
            await page.waitForSelector('.flex > .p-1 > .relative')
            await page.click('.flex > .p-1 > .relative')
            console.log('switch gpt4 ok!')
        } catch (e) {
            console.log(e);
            await page.reload();
            await Forefrontnew.switchToGpt4(page, triedTimes);
        }
        await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
        await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
    }

    private static async switchToClaudeP(page: Page, triedTimes: number = 0) {
        if (triedTimes === 3) {
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(5) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(5) > .relative');
            return;
        }
        try {
            console.log('switch claude+....')
            triedTimes += 1;
            await sleep(1000);
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(5) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(5) > .relative');
            await sleep(1000);
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(5) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(5) > .relative')
            await sleep(1000);
            await page.hover('div > .absolute > .relative > .w-full:nth-child(5) > .relative')

            // click never internet
            await page.waitForSelector('.flex > .p-1 > .relative')
            await page.click('.flex > .p-1 > .relative')

            console.log('switch claude+ ok!')
        } catch (e) {
            console.log(e);
            await page.reload();
            await Forefrontnew.switchToClaudeP(page, triedTimes);
        }
        await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(5) > .relative')
        await page.click('div > .absolute > .relative > .w-full:nth-child(5) > .relative');
    }

    private async allowClipboard(browser: Browser, page: Page) {
        const context = browser.defaultBrowserContext()
        await context.overridePermissions("https://chat.forefront.ai", [
            'clipboard-read',
            'clipboard-write',
        ])
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
            value: {
                //@ts-ignore
                writeText(text) {
                    this.text = text;
                },
            }
        }));
    }

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        try {
            if (!account) {
                throw new Error("account undefined, something error");
            }

            const [page] = await browser.pages();
            if (account.login_time) {
                await page.goto("https://chat.forefront.ai/");
                await page.setViewport({width: 1920, height: 1080});
                await Forefrontnew.closeVIPPop(page);
                const ok = await Forefrontnew.ifLogin(page);
                if (!ok) {
                    console.log(`logins status expired, delete ${account.id}`);
                    return [undefined, account];
                }
                await this.switch(page);
                await this.allowClipboard(browser, page);
                return [page, account];
            }
            await page.goto("https://accounts.forefront.ai/sign-up");
            await page.setViewport({width: 1920, height: 1080});
            await page.waitForSelector('#emailAddress-field');
            await page.click('#emailAddress-field')

            await page.waitForSelector('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary')
            await page.click('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary')

            const emailBox = CreateEmail(process.env.EMAIL_TYPE as TempEmailType || TempEmailType.TempEmail44)
            const emailAddress = await emailBox.getMailAddress();
            account.email = emailAddress;
            this.accountPool.syncfile();
            // 将文本键入焦点元素
            await page.keyboard.type(emailAddress, {delay: 10});
            await page.keyboard.press('Enter');

            const msgs = (await emailBox.waitMails()) as TempMailMessage[]
            let validateURL: string | undefined;
            for (const msg of msgs) {
                validateURL = msg.content.match(/https:\/\/clerk\.forefront\.ai\/v1\/verify\?_clerk_js_version=4.47.0&amp;token=[^\s"]+/i)?.[0];
                validateURL = validateURL?.replace('amp;', '');
                if (validateURL) {
                    break;
                }
            }
            if (!validateURL) {
                throw new Error('Error while obtaining verfication URL!')
            }
            await this.tryValidate(validateURL, 0);
            console.log('register successfully');
            account.login_time = moment().format(TimeFormat);
            this.accountPool.syncfile();
            await Forefrontnew.closeWelcomePop(page);
            await Forefrontnew.closeVIPPop(page);
            await page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {timeout: 120000})
            await this.switch(page);
            await this.allowClipboard(browser, page);
            return [page, account];
        } catch (e) {
            console.warn('something error happened,err:', e);
            return [] as any;
        }
    }

    public static async ifLogin(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('.flex:nth-child(2) > .relative > .sticky > .flex > .px-3:nth-child(1)', {timeout: 5000});
            await page.waitForSelector('.flex:nth-child(2) > .relative > .sticky > .flex > .border', {timeout: 5000});
            return false;
        } catch (e) {
            return true;
        }
    }

    public static async copyContent(page: Page) {
        await page.waitForSelector('.opacity-100 > .flex > .relative:nth-child(3) > .flex > .cursor-pointer', {timeout: 5 * 60 * 1000})
        await page.click('.opacity-100 > .flex > .relative:nth-child(3) > .flex > .cursor-pointer')
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
            await page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {
                timeout: 10000,
                visible: true
            })
            console.log('found input');
            await page.click('.relative > .flex > .w-full > .text-th-primary-dark > div')
            await page.focus('.relative > .flex > .w-full > .text-th-primary-dark > div')
            await page.keyboard.type(req.prompt);
            await page.keyboard.press('Enter');
            await page.waitForSelector('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
            // find markdown list container
            const mdList = await page.$('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
            const md = mdList;
        } catch (e) {
            console.error(e);
            destroy();
            stream.write(Event.error, {error: 'some thing error, try again later'});
            stream.end();
            return
        }

        // get latest markdown id
        let id = 4;
        (async () => {
            let itl;
            try {
                const selector = `div > .w-full:nth-child(${id}) > .flex > .flex > .post-markdown`;
                await page.waitForSelector(selector);
                const result = await page.$(selector)
                itl = setInterval(async () => {
                    const text: any = await result?.evaluate(el => {
                        return el.textContent;
                    });
                    if (text) {
                        stream.write(Event.message, {content: text})
                    }
                }, 100)
                if (!page) {
                    return;
                }
                await Forefrontnew.copyContent(page);
                //@ts-ignore
                const text: any = await page.evaluate(() => navigator.clipboard.text);
                const sourceText: any = await result?.evaluate(el => {
                    return el.textContent;
                })
                console.log('chat end: ', text);
                if (sourceText.length - text > 50) {
                    stream.write(Event.done, {content: sourceText});
                } else {
                    stream.write(Event.done, {content: text})
                }
            } catch (e) {
                console.error(e);
            } finally {
                stream.end();
                await page.waitForSelector('.flex:nth-child(1) > div:nth-child(2) > .relative > .flex > .cursor-pointer')
                await page.click('.flex:nth-child(1) > div:nth-child(2) > .relative > .flex > .cursor-pointer')
                account.gpt4times += 1;
                this.accountPool.syncfile();
                if (account.gpt4times >= MaxGptTimes) {
                    account.gpt4times = 0;
                    account.last_use_time = moment().format(TimeFormat);
                    this.accountPool.syncfile();
                    destroy();
                } else {
                    done(account);
                }
                if (itl) {
                    clearInterval(itl);
                }
            }
        })().then();
        return
    }

}
