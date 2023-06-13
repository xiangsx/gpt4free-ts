import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {ErrorData, Event, EventStream, MessageData, parseJSON} from "../../utils";
import {v4} from "uuid";
import moment from "moment";

interface RealReq {
    question: string;
    chat_id: string;
    timestamp: number;
}

export class ChatDemo extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://chat.chatgptdemo.net',
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
                        break;
                    case Event.message:
                        result.content += (data as MessageData).content || '';
                        break;
                    case Event.error:
                        result.error = (data as ErrorData).error;
                        break;
                }
            }, () => {
                resolve(result);
            })
        })

    }

    public async askStream(req: ChatRequest, stream: EventStream) {
        const data: RealReq = {
            question: req.prompt,
            chat_id: v4(),
            timestamp: moment().valueOf(),
        };
        try {
            const res = await this.client.post('/chat_api_stream', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                const dataStr = chunk.replace('data: ', '');
                if (!dataStr) {
                    return;
                }
                const data = parseJSON(dataStr, {} as any);
                if (!data?.choices) {
                    stream.write(Event.error, {error: 'not found data.choices'})
                    stream.end();
                    return;
                }
                const [{delta: {content = ""}, finish_reason}] = data.choices;
                if (finish_reason === 'stop') {
                    stream.end();
                    return;
                }
                stream.write(Event.message, {content});
            }))
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }
    }
}
