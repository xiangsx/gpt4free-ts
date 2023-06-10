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

type PrepareFunc<T> = (id: string, browser: Browser) => Promise<[Page | undefined, T, string]>

export class BrowserPool<T> {
    private readonly pool: PageInfo<T>[] = [];
    private readonly size: number;
    private readonly prepare: PrepareFunc<T>

    constructor(size: number, initialIDs: string[], prepare: PrepareFunc<T>) {
        this.size = size
        this.prepare = prepare;
        this.init(initialIDs);
    }

    init(initialIDs: string[]) {
        for (let i = 0; i < this.size; i++) {
            const id = initialIDs[i];
            const info: PageInfo<T> = {
                id,
                ready: false,
            }
            this.initOne(id).then(([page, data, newID]) => {
                if (!page) {
                    return;
                }
                info.id = newID;
                info.page = page;
                info.data = data;
                info.ready = true;
            }).catch(e => {
                console.error(e);
            })
            this.pool.push(info)
        }
    }

    async initOne(id: string): Promise<[Page, T, string]> {
        const options: PuppeteerLaunchOptions = {
            headless: process.env.DEBUG === "1" ? false : 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            userDataDir: `run/${id}`,
        };
        const browser = await puppeteer.launch(options);
        const [page, data, newID] = await this.prepare(id, browser)
        if (!page) {
            console.log(`init ${id} failed, delete! init new ${newID}`);
            await browser.close();
            if (options.userDataDir) {
                fs.rmdirSync(options.userDataDir, {recursive: true});
            }
            await sleep(5000);
            return this.initOne(newID);
        }
        return [page, data, newID];
    }

    //@ts-ignore
    get(): [page: Page | undefined, data: T | undefined, done: (data: T) => void, destroy: (newID: string) => void] {
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
                    (newID: string) => {
                        item.page?.close();
                        this.initOne(newID).then(([page, data, newID]) => {
                            item.id = newID;
                            item.page = page
                            item.data = data;
                            item.ready = true;
                        })
                    }
                ]
            }
        }
        return [] as any;
    }
}
