import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool} from "../../pool/puppeteer";
import {CreateEmail, TempEmailType, TempMailMessage} from "../../utils/emailFactory";
import {CreateTlsProxy} from "../../utils/proxyAgent";
import {PassThrough} from "stream";

type PageData = {
    gpt4times: number;
}

const MaxGptTimes = 4;

export class Forefrontnew extends Chat {
    private page: Page | undefined = undefined;
    private msgSize: number = 0;
    private pagePool: BrowserPool<PageData>;

    constructor(options?: ChatOptions) {
        super(options);
        this.pagePool = new BrowserPool<PageData>(+(process.env.POOL_SIZE || 2), this.init.bind(this));
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

    private async init(browser: Browser): Promise<Page> {
        const [page] = await browser.pages();
        await page.goto("https://accounts.forefront.ai/sign-up");
        await page.setViewport({width: 1920, height: 1080});
        await page.waitForSelector('#emailAddress-field');
        await page.click('#emailAddress-field')

        await page.waitForSelector('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary')
        await page.click('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary')

        const emailBox = CreateEmail(process.env.EMAIL_TYPE as TempEmailType || TempEmailType.TempEmail44)
        const emailAddress = await emailBox.getMailAddress();
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
        await page.waitForSelector('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)', {timeout: 10000})
        await page.click('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)')
        await page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {timeout: 10000})

        await page.waitForTimeout(2000);
        await page.waitForSelector('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium', {timeout: 100000});
        await page.click('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium');
        await page.waitForSelector('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium')
        await page.click('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium')

        await page.waitForSelector('.px-4 > .flex > .grid > .h-9 > .grow')
        await page.click('.px-4 > .flex > .grid > .h-9 > .grow')

        await page.waitForSelector('.grid > .block > .group:nth-child(5) > .grid > .grow:nth-child(1)')
        await page.click('.grid > .block > .group:nth-child(5) > .grid > .grow:nth-child(1)')
        return page;
    }

    public async askStream(req: Request): Promise<ResponseStream> {
        const [page, data = {gpt4times: 0} as PageData, done, destroy] = this.pagePool.get();
        if (!page) {
            const pt = new PassThrough();
            pt.write('please wait init.....about 1 min');
            pt.end();
            return {text: pt}
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
                data.gpt4times += 1;
                if (data.gpt4times >= MaxGptTimes) {
                    destroy();
                } else {
                    done(data);
                }
                clearInterval(itl);
            }
        })().then();
        return {text: pt}
    }

}
