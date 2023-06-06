import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool} from "../../pool/puppeteer";
import {CreateEmail, TempEmailType, TempMailMessage} from "../../utils/emailFactory";
import {CreateTlsProxy} from "../../utils/proxyAgent";
import {PassThrough} from "stream";
import * as fs from "fs";
import {parseJSON} from "../../utils";
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

    public get(): Account {
        const now = moment();
        const minInterval = 3 * 60 * 60 + 10 * 60;// 3hour + 10min
        for (const item of this.pool) {
            console.log(now.unix() - moment(item.last_use_time).unix());
            if (now.unix() - moment(item.last_use_time).unix() > minInterval) {
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


export class Forefrontnew extends Chat {
    private pagePool: BrowserPool<Account>;
    private accountPool: AccountPool;

    constructor(options?: ChatOptions) {
        super(options);
        this.accountPool = new AccountPool();
        const maxSize = +(process.env.POOL_SIZE || 2);
        const initialAccounts = this.accountPool.multiGet(maxSize);
        this.pagePool = new BrowserPool<Account>(maxSize, initialAccounts.map(item => item.id), this.init.bind(this));
    }

    public async ask(req: Request): Promise<Response> {
        const res = await this.askStream(req);
        let text = '';
        return new Promise(resolve => {
            res.text.on('data', (data) => {
                if (!data) {
                    return;
                }
                text += data;
            }).on('close', () => {
                resolve({text, other: res.other});
            })
        })
    }

    private async tryValidate(validateURL: string, triedTimes: number) {
        if (triedTimes === 3) {
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

    private static async switchToGpt4(page: Page) {
        try {
            console.log('switch gpt4....')
            await page.waitForTimeout(2000);
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative');
            await page.waitForTimeout(1000);
            await page.waitForSelector('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await page.click('div > .absolute > .relative > .w-full:nth-child(3) > .relative')
            await page.waitForTimeout(1000);
            await page.hover('div > .absolute > .relative > .w-full:nth-child(3) > .relative')

            await page.waitForSelector('.grid > .h-9 > .text-th-primary-light > g > path')
            await page.click('.grid > .h-9 > .text-th-primary-light > g > path')

            await page.waitForSelector('.px-4 > .flex > .grid > .block > .group:nth-child(5)')
            await page.click('.px-4 > .flex > .grid > .block > .group:nth-child(5)')
            console.log('switch gpt4 ok!')
        }catch (e) {
            console.log(e);
            await page.reload();
            await Forefrontnew.switchToGpt4(page);
        }
    }

    private async init(id: string, browser: Browser): Promise<[Page, Account]> {
        const account = this.accountPool.getByID(id);
        if (!account) {
            throw new Error("account undefined, something error");
        }

        const [page] = await browser.pages();
        if (account.login_time) {
            await page.goto("https://chat.forefront.ai/");
            await page.setViewport({width: 1920, height: 1080});
            await Forefrontnew.switchToGpt4(page);
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
            validateURL = msg.content.match(/https:\/\/clerk\.forefront\.ai\/v1\/verify\?token=[^\s"]+/i)?.[0];
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
        await page.waitForSelector('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)', {timeout: 10000})
        await page.click('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)')
        await page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {timeout: 10000})

        await Forefrontnew.switchToGpt4(page);
        return [page, account];
    }

    public async askStream(req: Request): Promise<ResponseStream> {
        const [page, account, done, destroy] = this.pagePool.get();
        if (!account) {
            const pt = new PassThrough();
            pt.write('account undefined, something error');
            pt.end();
            return {text: pt};
        }
        if (!page) {
            const pt = new PassThrough();
            pt.write('please wait init.....about 1 min');
            pt.end();
            return {text: pt};
        }
        try {
            console.log('try find text input');
            await page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {timeout: 10000})
        } catch (e) {
            console.error(e);
        }
        console.log('try to find input');
        await page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {
            timeout: 10000,
            visible: true
        })
        console.log('found');
        await page.click('.relative > .flex > .w-full > .text-th-primary-dark > div')
        await page.focus('.relative > .flex > .w-full > .text-th-primary-dark > div')
        await page.keyboard.type(req.prompt, {delay: 10});
        await page.keyboard.press('Enter');
        await page.waitForSelector('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
        // find markdown list container
        const mdList = await page.$('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
        const md = mdList;
        // get latest markdown id
        let id: number = 4;
        const selector = `div > .w-full:nth-child(${id}) > .flex > .flex > .post-markdown`;
        await page.waitForSelector(selector);
        const result = await page.$(selector)
        // get latest markdown text
        let oldText = '';
        const pt = new PassThrough();
        (async () => {
            const itl = setInterval(async () => {
                const text: any = await result?.evaluate(el => {
                    return el.textContent;
                });
                if (typeof text != 'string') {
                    return;
                }
                if (oldText.length === text.length) {
                    return;
                }
                pt.write(text.slice(oldText.length - text.length));
                oldText = text;
            }, 100)
            if (!page) {
                return;
            }
            try {
                // wait chat end
                await page.waitForSelector(`.w-full > .flex > .flex > .flex > .opacity-100`, {timeout: 5 * 60 * 1000});
                const text: any = await result?.evaluate(el => {
                    return el.textContent;
                });
                if (oldText.length !== text.length) {
                    pt.write(text.slice(oldText.length - text.length));
                }
            } finally {
                pt.end();
                await page.waitForSelector('.flex:nth-child(1) > div:nth-child(2) > .relative > .flex > .cursor-pointer')
                await page.click('.flex:nth-child(1) > div:nth-child(2) > .relative > .flex > .cursor-pointer')
                account.gpt4times += 1;
                this.accountPool.syncfile();
                if (account.gpt4times >= MaxGptTimes) {
                    account.gpt4times = 0;
                    account.last_use_time = moment().format(TimeFormat);
                    this.accountPool.syncfile();
                    const newAccount = this.accountPool.get();
                    destroy(newAccount.id);
                } else {
                    done(account);
                }
                clearInterval(itl);
            }
        })().then();
        return {text: pt}
    }

}
