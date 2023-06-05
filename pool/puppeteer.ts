import puppeteer, {Browser, Page, PuppeteerLaunchOptions} from "puppeteer";
import path from "path";
import run from "node:test";

const runPath = path.join(__dirname, 'run');

export interface PageInfo<T> {
    id: number;
    ready: boolean;
    page?: Page;
    data?: T;
}

type PrepareFunc<T> = (browser: Browser) => Promise<Page>

export class BrowserPool<T> {
    private readonly pool: PageInfo<T>[] = [];
    private readonly size: number;
    private readonly prepare: PrepareFunc<T>

    constructor(size: number, prepare: PrepareFunc<T>,) {
        this.size = size
        this.prepare = prepare;
        this.init();
    }

    init() {
        for (let i = 0; i < this.size; i++) {
            const info: PageInfo<T> = {
                id: i,
                ready: false,
            }
            this.initOne().then(page => {
                info.page = page;
                info.ready = true;
            }).catch(e=>{
                console.error(e);
            })
            this.pool.push(info)
        }
    }

    async initOne(): Promise<Page> {
        const options: PuppeteerLaunchOptions = {
            headless: process.env.DEBUG === "1" ? false : 'new',
            args: ['--no-sandbox'],
        };
        const browser = await puppeteer.launch(options)
        return this.prepare(browser)
    }

    //@ts-ignore
    get(): [page: Page | undefined, data: T | undefined, done: (data: T) => void, destroy: () => void] {
        for (const item of this.pool) {
            if (item.ready) {
                item.ready = false;
                return [
                    item.page,
                    item.data,
                    (data: T) => {
                        item.ready = true
                        item.data = data;
                    },
                    () => {
                        this.initOne().then((page) => {
                            item.page = page
                            item.ready = true;
                        })
                    }
                ]
            }
        }
    }
}
