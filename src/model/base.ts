import {Stream} from "stream";

export interface ChatOptions {
}

export interface Response {
    text: string | null;
    other?: any;
}

export interface ResponseStream {
    text: Stream;
    other?: any;
}

export interface Request {
    prompt: string;
    options?: any;
}

export abstract class Chat {
    protected options: ChatOptions | undefined;

    protected constructor(options?: ChatOptions) {
        this.options = options;
    }

    public abstract ask(req: Request): Promise<Response>

    public abstract askStream(req: Request): Promise<ResponseStream>
}
