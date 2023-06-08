import es from 'event-stream';
import {PassThrough, Stream} from 'stream';
import * as crypto from 'crypto';
import {v4} from "uuid";

type eventFunc = (eventName: string, data: string) => void;

export function toEventCB(arr: Uint8Array, emit: eventFunc) {
    const pt = new PassThrough();
    pt.write(arr)
    pt.pipe(es.split(/\r?\n\r?\n/))                 //split stream to break on newlines
        .pipe(es.map(async function (chunk: any, cb: Function) { //turn this async function into a stream
            const [eventStr, dataStr] = (chunk as any).split(/\r?\n/)
            const event = eventStr.replace(/event: /, '');
            const data = dataStr.replace(/data: /, '');
            emit(event, data);
            cb(null, {data, event});
        }))
}

export function toEventStream(arr: Uint8Array): Stream {
    const pt = new PassThrough();
    pt.write(arr)
    return pt;
}

export function md5(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
}

export function randomStr(): string {
    return v4().split('-').join('').slice(-6);
}

export function parseJSON<T>(str: string, defaultObj: T): T {
    try {
        return JSON.parse(str)
    } catch (e) {
        console.error(str, e);
        return defaultObj;
    }
}

export function encryptWithAes256Cbc(data: string, key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', hash, iv);

    let encryptedData = cipher.update(data, 'utf-8', 'hex');
    encryptedData += cipher.final('hex');

    return iv.toString('hex') + encryptedData;
}

export async function sleep(duration: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), duration);
    })
}

export function shuffleArray<T>(array: T[]): T[] {
    const shuffledArray = [...array];
    for (let i = shuffledArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    return shuffledArray;
}
