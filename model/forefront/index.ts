import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {Page} from "puppeteer";
import {FreeBrowser, freeBrowserPool} from "../../pool/puppeteer";
import {CreateEmail, TempEmailType, TempMailMessage} from "../../utils/emailFactory";
import {CreateTlsProxy} from "../../utils/proxyAgent";
import {PassThrough} from "stream";

export class Forefrontnew extends Chat {
    private browser: FreeBrowser | undefined;
    private page: Page | undefined = undefined;
    private url: string = 'https://chat.forefront.ai/';
    private writing: NodeJS.Timer | undefined = undefined;
    private msgSize: number = 0;

    constructor(options?: ChatOptions) {
        super(options);
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
            await this.remove();
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

    private async remove() {
        await freeBrowserPool.remove(this.browser?.id || "");
        this.browser = undefined;
        this.page = undefined;
        this.msgSize = 0;
    }

    private async init(): Promise<Page> {
        this.browser = freeBrowserPool.getRandom();
        this.page = await this.browser.getPage("https://accounts.forefront.ai/sign-up");
        await this.page.setViewport({width: 1920, height: 1080});
        await this.page.waitForSelector('#emailAddress-field');
        await this.page.click('#emailAddress-field')

        await this.page.waitForSelector('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary')
        await this.page.click('.cl-rootBox > .cl-card > .cl-main > .cl-form > .cl-formButtonPrimary')

        const emailBox = CreateEmail(TempEmailType.TempEmail44)
        const emailAddress = await emailBox.getMailAddress();
        // 将文本键入焦点元素
        await this.page.keyboard.type(emailAddress, {delay: 10});
        await this.page.keyboard.press('Enter');

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
        await this.page.waitForSelector('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)', {timeout: 10000})
        await this.page.click('.flex > .modal > .modal-box > .flex > .px-3:nth-child(1)')
        await this.page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {timeout: 10000})

        await this.page.waitForTimeout(2000);
        await this.page.waitForSelector('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium', {timeout: 100000});
        await this.page.click('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium');
        await this.page.waitForSelector('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium')
        await this.page.click('.absolute > .shadow > .w-full:nth-child(2) > .flex > .font-medium')

        await this.page.waitForSelector('.px-4 > .flex > .grid > .h-9 > .grow')
        await this.page.click('.px-4 > .flex > .grid > .h-9 > .grow')

        await this.page.waitForSelector('.grid > .block > .group:nth-child(5) > .grid > .grow:nth-child(1)')
        await this.page.click('.grid > .block > .group:nth-child(5) > .grid > .grow:nth-child(1)')
        return this.page;
    }

    public async askStream(req: Request): Promise<ResponseStream> {
        if (this.writing) {
            const pt = new PassThrough();
            pt.write('Other conversation');
            pt.end();
            return {text: pt}
        }
        if (this.msgSize === 5) {
            await this.remove();
        }
        this.msgSize++;
        if (!this.browser || !this.page) {
            this.page = await this.init();
        }
        try {
            console.log('try find text input');
            await this.page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {timeout: 10000})
        } catch (e) {
            console.error(e);
        }
        console.log('try to find input');
        await this.page.waitForSelector('.relative > .flex > .w-full > .text-th-primary-dark > div', {
            timeout: 10000,
            visible: true
        })
        console.log('found');
        await this.page.click('.relative > .flex > .w-full > .text-th-primary-dark > div')
        await this.page.focus('.relative > .flex > .w-full > .text-th-primary-dark > div')
        await this.page.keyboard.type(req.prompt, {delay: 10});
        await this.page.keyboard.press('Enter');
        await this.page.waitForSelector('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
        // find markdown list container
        const mdList = await this.page.$('#__next > .flex > .relative > .relative > .w-full:nth-child(1) > div');
        const md = mdList;
        // get latest markdown id
        let id: number = this.msgSize * 4;
        const selector = `div > .w-full:nth-child(${id}) > .flex > .flex > .post-markdown`;
        await this.page.waitForSelector(selector);
        const result = await this.page.$(selector)
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
            if (!this.page) {
                return;
            }
            try {
                await this.page.waitForSelector(`.w-full:nth-child(${id}) > .flex > .flex > .flex > .opacity-100`);
                const text: any = await result?.evaluate(el => {
                    return el.textContent;
                });
                if (oldText.length !== text.length) {
                    pt.write(text.slice(oldText.length - text.length));
                }
            } finally {
                pt.end();
                clearInterval(itl);
            }
        })().then();
        return {text: pt}
    }

}
