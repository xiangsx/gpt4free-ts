import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {DoneData, ErrorData, Event, EventStream, isSimilarity, MessageData, sleep} from "../../utils";
import {v4} from "uuid";
import TurndownService from "turndown";

let turndownService = new TurndownService({codeBlockStyle: 'fenced'}).remove('h6');
turndownService = turndownService.remove('h6');
const preText = `###### Answer | gpt-3.5 Model\n\n`;
type PageData = {
    gpt4times: number;
}

const MaxGptTimes = 4;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

type Account = {
    id: string;
}
const url = "https://www.phind.com";

export class Phind extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;

    constructor(options?: ChatOptions) {
        super(options);
        const maxSize = +(process.env.PHIND_POOL_SIZE || 0);
        this.pagePool = new BrowserPool<Account>(maxSize, this);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.NetGpt3p5:
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

    static async allowClipboard(browser: Browser, page: Page) {
        const context = browser.defaultBrowserContext()
        await context.overridePermissions(url, [
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

    deleteID(id: string): void {
    }

    newID(): string {
        return v4();
    }

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const [page] = await browser.pages();
        await Phind.allowClipboard(browser, page);

        await page.goto(url);
        await sleep(2000);
        await page.waitForSelector('.mb-3 > div > div > .mt-6 > .btn-primary')
        await Phind.allowClipboard(browser, page);
        console.log('phind init ok!');
        return [page, {id}]
    }

    public static async copyContent(page: Page) {
        await page.waitForSelector('.row > .col-lg-8 > .container-xl > .mb-4 > .btn:nth-child(3)', {timeout: 5 * 60 * 1000})
        await page.click('.row > .col-lg-8 > .container-xl > .mb-4 > .btn:nth-child(3)')
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
            await page.waitForSelector('.col-md-10 > .container-xl > .mb-3 > .input-group > .form-control')
            await page.click('.col-md-10 > .container-xl > .mb-3 > .input-group > .form-control')
            await page.focus('.col-md-10 > .container-xl > .mb-3 > .input-group > .form-control')

            await page.keyboard.type(req.prompt);
            await page.keyboard.press('Enter');
            await page.waitForSelector('.col-lg-10 > .row > .col-lg-8:nth-child(4) > .container-xl > div:nth-child(1)');
            const output = await page.$('.col-lg-10 > .row > .col-lg-8:nth-child(4) > .container-xl > div:nth-child(1)');
            let old = '';
            const itl = setInterval(async () => {
                try {
                    const content: any = await output?.evaluate(el => {
                        return el.outerHTML;
                    });
                    if (old !== content) {
                        stream.write(Event.message, {content: turndownService.turndown(content).replace(preText,'')});
                        old = content;
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 1000)
            const wait = async () => {
                await Phind.copyContent(page);
                clearInterval(itl);
                //@ts-ignore
                const text: any = (await page.evaluate(() => navigator.clipboard.text)) || '';
                const sourcehtml: any = await output?.evaluate((el: any) => {
                    return el.outerHTML;
                })
                console.log('chat end: ', text);
                const sourceText = turndownService.turndown(sourcehtml).replace(preText,'');
                if (isSimilarity(text, sourceText)) {
                    stream.write(Event.done, {content: text});
                } else {
                    stream.write(Event.done, {content: sourceText});
                }
                stream.end();
                done(account);
                await page.goto(url);
            }
            wait().then().catch(async (e) => {
                console.error(e);
                stream.write(Event.error, {error: e.message})
                stream.end();
                await page.goto(url);
            });
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
            await page.goto(url);
            return;
        }
        return
    }

}
