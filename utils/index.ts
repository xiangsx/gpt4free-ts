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

export function parseJSON(str: string, defaultObj: any): any | undefined {
    try {
        return JSON.parse(str)
    } catch (e) {
        console.error(str,e);
        return defaultObj;
    }
}
