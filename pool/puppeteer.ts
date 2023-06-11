import {Browser, Page, PuppeteerLaunchOptions} from "puppeteer";
import path from "path";
import run from "node:test";
import * as fs from "fs";
import {shuffleArray, sleep} from "../utils";
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const runPath = path.join(__dirname, 'run');

export interface PageInfo<T> {
    id: string;
    ready: boolean;
    page?: Page;
    data?: T;
}

type PrepareFunc<T> = (id: string, browser: Browser) => Promise<[Page | undefined, T]>

export interface BrowserUser<T> {
    init: PrepareFunc<T>;
    newID: () => string
    deleteID: (id: string) => void
}

export class BrowserPool<T> {
    private readonly pool: PageInfo<T>[] = [];
    private readonly size: number;
    private readonly user: BrowserUser<T>

    constructor(size: number, user: BrowserUser<T>) {
        this.size = size
        this.user = user;
        this.init();
    }

    init() {
        for (let i = 0; i < this.size; i++) {
            const id = this.user.newID();
            const info: PageInfo<T> = {
                id,
                ready: false,
            }
            this.pool.push(info)
            this.initOne(id).then()
        }
    }

    find(id: string): PageInfo<T> | undefined {
        for (const info of this.pool) {
            if (info.id === id) {
                return info;
            }
        }
    }

    async initOne(id: string): Promise<void> {
        const info = this.find(id);
        if (!info) {
            console.error('init one failed, not found info');
            return;
        }
        const options: PuppeteerLaunchOptions = {
            headless: process.env.DEBUG === "1" ? false : 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            userDataDir: `run/${info.id}`,
        };
        try {
            const browser = await puppeteer.launch(options);
            const [page, data] = await this.user.init(info.id, browser);
            if (!page) {
                const newID = this.user.newID();
                console.warn(`init ${info.id} failed, delete! init new ${newID}`);
                await browser.close();
                if (options.userDataDir) {
                    fs.rmdirSync(options.userDataDir, {recursive: true});
                }
                await sleep(5000);
                info.id = newID;
                return await this.initOne(info.id);
            }
            info.page = page;
            info.data = data
            info.ready = true;
        } catch (e) {
            console.error('init one failed, err:', e);
            const newID = this.user.newID();
            console.warn(`init ${info.id} failed, delete! init new ${newID}`);
            if (options.userDataDir) {
                fs.rmdirSync(options.userDataDir, {recursive: true});
            }
            await sleep(5000);
            info.id = newID;
            return await this.initOne(info.id);
        }
    }

    //@ts-ignore
    get(): [page: Page | undefined, data: T | undefined, done: (data: T) => void, destroy: () => void] {
        for (const item of shuffleArray(this.pool)) {
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
                        item.page?.close();
                        this.user.deleteID(item.id);
                        item.id = this.user.newID();
                        this.initOne(item.id).then();
                    }
                ]
            }
        }
        return [] as any;
    }
}
