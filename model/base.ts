import {Stream} from "stream";

export interface ChatOptions {
    proxy?: string;
}

export interface Response {
    text: string | null;
    other: any;
}

export interface ResponseStream {
    text: Stream;
    other: any;
}

export interface Request {
    prompt: string;
    history?: HistoryItem[];
    options?: any;
}

export interface HistoryItem {
    question?: string;
    answer?: string;
}


export abstract class Chat {
    protected proxy: string | undefined;

    constructor(options?: ChatOptions) {
        this.proxy = options?.proxy;
    }

    public abstract ask(req: Request): Promise<Response>

    public abstract askStream(req: Request): Promise<ResponseStream>
}
