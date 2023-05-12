import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {Page} from "puppeteer";
import {FreeBrowser, freeBrowserPool} from "../../pool/puppeteer";
import {Stream} from "stream";

export class Phind extends Chat {
    private browser: FreeBrowser | undefined;
    private page: Page | undefined = undefined;

    constructor(options?: ChatOptions) {
        super(options);
    }

    public async ask(req: Request): Promise<Response> {
        return Promise.resolve({text: ''});
    }

    public async askStream(req: Request): Promise<ResponseStream> {
        if (!this.browser) {
            this.browser = freeBrowserPool.getRandom();
        }
        if (!this.page) {
            this.page = await this.browser.getPage('https://phind.com');
            await this.page.setViewport({width: 1920, height: 1080})
            // await this.page.waitForNavigation();
        }

        // await this.page.waitForSelector('.col-md-10 > .container-xl > .mb-3 > .input-group > .form-control')
        // await this.page.click('.col-md-10 > .container-xl > .mb-3 > .input-group > .form-control')
        // todo complete
        return Promise.resolve({text: new Stream()});
    }

}
