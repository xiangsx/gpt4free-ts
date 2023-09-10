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
    temperature: number;
    stream: boolean;
    model: string;
}

export class Gra extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://gpt4.xunika.uk/api/openai/v1/',
            headers: {
                'Content-Type': 'application/json',
                "accept": "text/event-stream",
                "Cache-Control": "no-cache",
                "Proxy-Connection": "keep-alive",
            }
        } as CreateAxiosDefaults);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT3p5Turbo:
                return 4000;
            case ModelType.GPT3p5_16k:
                return 15000;
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
            messages: [{role: 'user', content: req.prompt}],
            temperature: 1.0,
            model: req.model,
            stream: true
        };
        try {
            const res = await this.client.post('/chat/completions', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.pipe(es.split(/\r?\n\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                const dataStr = chunk.replace('data: ', '');
                if (!dataStr) {
                    return;
                }
                if (dataStr === '[DONE]') {
                    stream.write(Event.done, {content: ''})
                    stream.end();
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
                    return;
                }
                stream.write(Event.message, {content});
            }))
        } catch (e: any) {
            console.error(e.message);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }
    }
}
