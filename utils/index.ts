import es from 'event-stream';
import {PassThrough, Stream} from 'stream';
import * as crypto from 'crypto';
import {v4} from "uuid";
import {encoding_for_model} from '@dqbd/tiktoken'
import TurndownService from "turndown";
import stringSimilarity from 'string-similarity';

const en = encoding_for_model("gpt-3.5-turbo");
const turndownService = new TurndownService({codeBlockStyle: 'fenced'});


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
        console.log(str);
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

export type ErrorData = { error: string; };
export type MessageData = { content: string };
export type DoneData = MessageData;

export enum Event {
    error = 'error',
    message = 'message',
    done = 'done',
}

export type Data<T extends Event> =
    T extends Event.error ? ErrorData :
        T extends Event.message ? MessageData :
            T extends Event.done ? DoneData : any;


export type DataCB<T extends Event> = (event: T, data: Data<T>) => void

export class EventStream {
    protected readonly pt: PassThrough = new PassThrough();

    constructor() {
        this.pt.setEncoding('utf-8');
    }

    public write<T extends Event>(event: T, data: Data<T>) {
        this.pt.write(`event: ${event}\n`, 'utf-8');
        this.pt.write(`data: ${JSON.stringify(data)}\n\n`, 'utf-8');
    }

    stream() {
        return this.pt;
    }

    end(cb?: () => void) {
        this.pt.end(cb)
    }

    public read(dataCB: DataCB<Event>, closeCB: () => void) {
        this.pt.setEncoding('utf-8');
        this.pt.pipe(es.split('\n\n')).pipe(es.map(async (chunk: any, cb: any) => {
            const res = chunk.toString()
            if (!res) {
                return;
            }
            const [eventStr, dataStr] = res.split('\n');
            const event: Event = eventStr.replace('event: ', '');
            if (!(event in Event)) {
                dataCB(Event.error, {error: `EventStream data read failed, not support event ${event}`});
                return;
            }
            const data = parseJSON(dataStr.replace('data: ', ''), {} as Data<Event>);
            return dataCB(event, data);
        }))
        this.pt.on("close", closeCB)
    }
}

export class OpenaiEventStream extends EventStream {
    private id: string = "chatcmpl-" + randomStr() + randomStr();
    private start: boolean = false;

    write<T extends Event>(event: T, data: Data<T>) {
        if (!this.start) {
            this.pt.write(`data: ${JSON.stringify({
                id: this.id,
                object: "chat.completion.chunk",
                choices: [{index: 0, delta: {role: "assistant", content: ""}}],
                finish_reason: null
            })}\n\n`, 'utf-8');
            this.start = true;
        }
        switch (event) {
            case Event.done:
                this.pt.write(`data: ${JSON.stringify({
                    id: this.id,
                    object: "chat.completion.chunk",
                    choices: [{index: 0, delta: {}, finish_reason: "stop"}],
                    finish_reason: null
                })}\n\n`, 'utf-8');
                this.pt.write(`data: [DONE]\n\n`, 'utf-8');
                break;
            default:
                this.pt.write(`data: ${JSON.stringify({
                    id: this.id,
                    object: "chat.completion.chunk",
                    choices: [{index: 0, delta: data}],
                    finish_reason:null
                })}\n\n`, 'utf-8');
                break;
        }
    }

    read(dataCB: DataCB<Event>, closeCB: () => void) {
        this.pt.setEncoding('utf-8');
        this.pt.pipe(es.split(/\r?\n\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
            const dataStr = chunk.replace('data: ', '');
            if (!dataStr) {
                return;
            }
            if (dataStr === "[DONE]") {
                dataCB(Event.done, {content: ""})
                return;
            }
            const data = parseJSON(dataStr, {} as any);
            if (!data?.choices) {
                dataCB(Event.error, {error: `EventStream data read failed`});
                return;
            }
            const [{delta: {content = ""}, finish_reason}] = data.choices;
            dataCB(Event.message, {content});
        }))
        this.pt.on("close", closeCB)
    }
}

export const getTokenSize = (str: string) => {
    return en.encode(str).length;
};

export const htmlToMarkdown = (html: string): string => {
    return turndownService.turndown(html);
}

export const isSimilarity = (s1: string, s2: string): boolean => {
    const similarity = stringSimilarity.compareTwoStrings(s1, s2);
    console.log(similarity);
    return similarity > 0.3;
}
