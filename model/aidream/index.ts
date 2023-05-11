import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {Stream} from "stream";
import es from "event-stream";
import {parseJSON} from "../../utils";

export interface AiDreamReq extends Request {
    options: {
        parentMessageId: string
        systemMessage: string
        temperature: number;
        top_p: number
        parse: boolean;
    };
}

interface RealReq {
    options: {
        parentMessageId?: string;
    };
    prompt: string;
    systemMessage: string;
    temperature: number;
    top_p: number;
}

interface RealRes {
    role: string;
    id: string;
    parentMessageId: string;
    text: string;
    delta: string;
    detail: {
        id: string;
        object: string;
        created: number;
        model: string;
        choices: {
            delta: {
                content: string;
            };
            index: number;
            finish_reason: any;
        }[];
    };
}

export class AiDream extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'http://aidream.cloud/api/',
            headers: {
                "Cache-Control": "no-cache",
                "Proxy-Connection": "keep-alive"
            }
        } as CreateAxiosDefaults);
    }

    public async ask(req: AiDreamReq): Promise<Response> {
        req.options.parse = false;
        const res = await this.askStream(req)
        const result: Response = {
            text: '', other: {}
        }
        return new Promise(resolve => {
            res.text.pipe(es.split(/\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                const data = parseJSON(chunk, {}) as RealRes;
                if (!data?.detail?.choices) {
                    cb(null, '');
                    return;
                }
                const [{delta: {content}}] = data.detail.choices;
                result.other.parentMessageId = data.parentMessageId;
                cb(null, content);
            })).on('data', (data) => {
                result.text += data;
            }).on('close', () => {
                resolve(result);
            })
        })

    }

    public async askStream(req: AiDreamReq): Promise<ResponseStream> {
        const {prompt = ''} = req;
        const {
            systemMessage = 'You are ChatGPT, a large language model trained by OpenAI. Follow the user\'s instructions carefully. Respond using markdown.',
            temperature = 1.0,
            top_p = 1,
            parentMessageId,
            parse = true,
        } = req.options;
        const data: RealReq = {
            options: {parentMessageId}, prompt, systemMessage, temperature, top_p
        };
        const res = await this.client.post('/chat-process', data, {
            responseType: 'stream'
        } as AxiosRequestConfig);
        if (parse) {
            return {
                text: this.parseData(res.data)
            }
        }
        return {text: res.data};
    }

    parseData(v: Stream): Stream {
        return v.pipe(es.split(/\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
            const data = parseJSON(chunk, {}) as RealRes;
            if (!data?.detail?.choices) {
                cb(null, '');
                return;
            }
            const [{delta: {content}}] = data.detail.choices;
            cb(null, content);
        }))
    }
}
