import puppeteer, {Browser, Page, PuppeteerLaunchOptions} from "puppeteer";
import fs from 'fs';
import path from "path";
import run from "node:test";
import {randomUUID} from "crypto";
import {v4} from "uuid";

const runPath = path.join(__dirname, 'run');

export class FreeBrowser {
    private browser: Browser | undefined = undefined;
    private readonly options: PuppeteerLaunchOptions | undefined;
    private urls: Set<string> = new Set<string>();
    private pages: Record<string, Page> = {};
    public readonly id: string;

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

    public async close() {
        this.browser?.close();
    }
}


class FreeBrowserPool {
    private size: number = 0;
    private readonly pool: FreeBrowser[];
    private debug: boolean = false;

    constructor() {
        this.pool = [];
    }

    public async init(size: number,debug:boolean) {
        this.debug = debug;
        console.log(`browser pool init size:${size}`)
        if (!fs.existsSync(runPath)) {
            fs.mkdirSync(runPath);
        }
        this.size = size;
        for (let i = 0; i < size; i++) {
            this.pool.push(await this.newBrowser());
        }
    }

    public getRandom(): FreeBrowser {
        return this.pool[Math.floor(Math.random() * this.pool.length)]
    }

    private async newBrowser(): Promise<FreeBrowser> {
        const options: PuppeteerLaunchOptions = {
            headless: !this.debug,
            args: ['--no-sandbox']
        };
        const browser = new FreeBrowser(v4(), options);
        await browser.init();
        return browser;
    }

    public async remove(id: string) {
        let removed = false;
        this.pool.filter(item => {
            if (item.id === id) {
                item.close();
                removed = true;
                return false;
            }
            return true;
        })
        if (removed) {
            this.pool.push(await this.newBrowser());
        }
    }
}

export const freeBrowserPool = new FreeBrowserPool();
