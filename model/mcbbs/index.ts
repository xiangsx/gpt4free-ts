import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {ErrorData, Event, EventStream, MessageData, parseJSON} from "../../utils";

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

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT3p5Turbo:
                return 2000;
            default:
                return 0;
        }
    }

    public async ask(req: ChatRequest): Promise<ChatResponse> {
        const stream = new EventStream();
        const res = await this.askStream(req, stream);
        const result: ChatResponse = {
            content: '',
        }
        return new Promise(resolve => {
            stream.read((event, data) => {
                switch (event) {
                    case Event.done:
                        stream.end();
                        break;
                    case Event.message:
                        result.content = (data as MessageData).content
                        break;
                    case Event.error:
                        result.error = (data as ErrorData).error
                        break;
                }
            }, () => {
                resolve(result);
            })
        })

    }

    public async askStream(req: ChatRequest, stream: EventStream) {
        const data: RealReq = {
            stream: true,
            messages: [{role: 'user', content: req.prompt}],
            temperature: 1,
            presence_penalty: 2,
            model: 'gpt-3.5-turbo'
        };
        try {
            const res = await this.client.post('/openai/v1/chat/completions', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                const dataStr = chunk.replace('data: ', '');
                if (dataStr === '[Done]') {
                    stream.write(Event.done, dataStr);
                    return;
                }
                const data = parseJSON(dataStr, {} as any);
                if (!data?.choices) {
                    cb(null, '');
                    return;
                }
                const [{delta: {content = ""}}] = data.choices;
                stream.write(Event.message, {content});
            }))
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
        }
    }
}
