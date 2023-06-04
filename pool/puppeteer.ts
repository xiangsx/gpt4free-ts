import puppeteer, {Browser, Page, PuppeteerLaunchOptions} from "puppeteer";
import fs from 'fs';
import path from "path";
import run from "node:test";

const runPath = path.join(__dirname, 'run');

export class FreeBrowser {
    private browser: Browser | undefined = undefined;
    private readonly options: PuppeteerLaunchOptions | undefined;
    private urls: Set<string> = new Set<string>();
    private pages: Record<string, Page> = {};
    private readonly id: string;

    constructor(id: string, options?: PuppeteerLaunchOptions) {
        this.options = {
            // userDataDir: path.join(runPath, id),
            ...options
        };
        this.id = id;
    }

    public async init() {
        this.browser = await puppeteer.launch(this.options)
    }


    public async getPage(url: string): Promise<Page> {
        if (!this.browser) {
            throw new Error('Browser must init first')
        }
        if (this.pages[url]) {
            return this.pages[url];
        }
        const page = await this.browser.newPage();
        await page.goto(url)

        this.pages[url] = page;
        return page;
    }
}


class FreeBrowserPool {
    private size: number = 0;
    private readonly pool: FreeBrowser[];

    constructor() {
        this.pool = [];
    }

    public async init(size: number, debug: boolean) {
        console.log(`browser pool init size:${size}`)
        if (!fs.existsSync(runPath)) {
            fs.mkdirSync(runPath);
        }
        this.size = size;
        const options: PuppeteerLaunchOptions = {
            headless: !debug,
            args: ['--no-sandbox']
        };
        for (let i = 0; i < size; i++) {
            const browser = new FreeBrowser(`${i}`, options);
            await browser.init();
            this.pool.push(browser);
        }
    }

    public getRandom(): FreeBrowser {
        return this.pool[Math.floor(Math.random() * this.pool.length)]
    }
}

export const freeBrowserPool = new FreeBrowserPool();
