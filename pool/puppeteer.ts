import normalPPT, {Browser, Page, PuppeteerLaunchOptions} from "puppeteer";
import path from "path";
import run from "node:test";
import * as fs from "fs";
import {shuffleArray, sleep} from "../utils";
import {launchChromeAndFetchWsUrl} from "../utils/proxyAgent";

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

let pptPort = 9225;

export class BrowserPool<T> {
    private readonly pool: PageInfo<T>[] = [];
    private readonly size: number;
    private readonly user: BrowserUser<T>
    private savefile: boolean;
    private poolDelay: number;
    private useConnect: boolean;

    constructor(size: number, user: BrowserUser<T>, saveFile: boolean = true, poolDelay: number = 5 * 1000, useConnect: boolean = false) {
        this.size = size
        this.user = user;
        this.savefile = saveFile;
        this.poolDelay = poolDelay;
        this.useConnect = useConnect;
        this.init();
    }

    async init() {
        for (let i = 0; i < this.size; i++) {
            const id = this.user.newID();
            const info: PageInfo<T> = {
                id,
                ready: false,
            }
            this.pool.push(info)
            this.initOne(id).then()
            await sleep(this.poolDelay);
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
        console.log(id);
        if (!info) {
            console.error('init one failed, not found info');
            return;
        }
        const options: PuppeteerLaunchOptions = {
            headless: process.env.DEBUG === "1" ? false : 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox',`--proxy-server=${process.env.http_proxy}`],
            userDataDir: this.savefile ? `run/${info.id}` : undefined,
        };
        let browser;
        try {
            if (this.useConnect) {
                if (!process.env.CHROME_PATH) {
                    throw new Error('not config CHROME_PATH');
                }
                pptPort += 1;
                const res = await launchChromeAndFetchWsUrl();
                if (!res) {
                    throw new Error('launch chrome failed');
                }
                const wsLink = res.match(/(ws:\/\/[^ ]*)/)?.[0] || '';
                if (!wsLink) {
                    throw new Error('launch chrome failed');
                }
                browser = await normalPPT.connect({browserWSEndpoint: wsLink});
            } else {
                browser = await puppeteer.launch(options);
            }
            const [page, data] = await this.user.init(info.id, browser);
            if (!page) {
                this.user.deleteID(info.id);
                const newID = this.user.newID();
                console.warn(`init ${info.id} failed, delete! init new ${newID}`);
                await browser.close();
                if (options.userDataDir) {
                    fs.rm(options.userDataDir, {force: true, recursive: true}, () => {
                        console.log(`${info.id} has been deleted`)
                    });
                }
                await sleep(5000);
                info.id = newID;
                return await this.initOne(info.id);
            }
            info.page = page;
            info.data = data
            info.ready = true;
        } catch (e:any) {
            if (browser) {
                await browser.close();
            }
            console.error('init one failed, err:', e);
            this.user.deleteID(info.id);
            const newID = this.user.newID();
            console.warn(`init ${info.id} failed, delete! init new ${newID}`);
            if (options.userDataDir) {
                fs.rm(options.userDataDir, {force: true, recursive: true}, () => {
                    console.log(`${info.id} has been deleted`)
                });
            }
            await sleep(5000);
            info.id = newID;
            return await this.initOne(info.id);
        }
    }

    deleteIDFile(id: string) {
        fs.rm(`run/${id}`, {force: true, recursive: true}, () => {
            console.log(`${id} has been deleted`)
        })
    }

    //@ts-ignore
    get(): [page: Page | undefined, data: T | undefined, done: (data: T) => void, destroy: (force?: boolean, notCreate?: boolean) => void] {
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
                    (force?: boolean, notCreate?: boolean) => {
                        if (!item.page?.isClosed()) {
                            item.page?.close();
                        }
                        if (force) {
                            this.user.deleteID(item.id);
                            this.deleteIDFile(item.id);
                        }
                        if (!notCreate) {
                            item.id = this.user.newID();
                            this.initOne(item.id).then();
                        }
                    }
                ]
            }
        }
        return [] as any;
    }
}
