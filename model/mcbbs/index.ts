import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {parseJSON} from "../../utils";
import {Stream} from "stream";

interface Message {
    role: string;
    content: string;
}

interface RealReq {
    messages: Message[];
    stream: boolean;
    model: string;
    temperature: number;
    presence_penalty: number;
}

export interface McbbsReq extends Request {
    options: {
        parse: string;
        messages: string;
        temperature: number;
    }
}

export class Mcbbs extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://ai.mcbbs.gq/api',
            headers: {
                'Content-Type': 'application/json',
                "accept": "text/event-stream",
                "Cache-Control": "no-cache",
                "Proxy-Connection": "keep-alive"
            }
        } as CreateAxiosDefaults);
    }

    public async ask(req: McbbsReq): Promise<Response> {
        const res = await this.askStream(req)
        const result: Response = {
            text: '', other: {}
        }
        return new Promise(resolve => {
            res.text.on('data', (data) => {
                result.text += data;
            }).on('close', () => {
                resolve(result);
            })
        })

    }

    public async askStream(req: McbbsReq): Promise<ResponseStream> {
        const {
            messages,
            temperature = 1,
            parse = 'true'
        } = req.options;
        const data: RealReq = {
            stream: true,
            messages: JSON.parse(messages),
            temperature,
            presence_penalty: 2,
            model: 'gpt-3.5-turbo'
        };
        const res = await this.client.post('/openai/v1/chat/completions', data, {
            responseType: 'stream',
        } as AxiosRequestConfig);
        if (parse === 'false') {
            return {text: res.data}
        }
        return {
            text: this.parseData(res.data)
        };
    }

    parseData(v: Stream): Stream {
        return v.pipe(es.split(/\r?\n\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
            const dataStr = chunk.replace('data: ', '');
            if (dataStr === '[Done]') {
                cb(null, '');
                return;
            }
            const data = parseJSON(dataStr, {} as any);
            if (!data?.choices) {
                cb(null, '');
                return;
            }
            const [{delta: {content = ""}}] = data.choices;
            cb(null, content);
        }))
    }
}
