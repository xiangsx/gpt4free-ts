import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {ErrorData, Event, EventStream, MessageData} from "../../utils";

interface AssistantMessage {
    role: string;
    content: string;
}

interface Model {
    id: string;
    name: string;
    maxLength: number;
    tokenLimit: number;
}

interface RealReq {
    model: Model;
    messages: AssistantMessage[];
    key: string;
    prompt: string;
    temperature: number;
}

export class Skailar extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://chat.skailar.net/api',
            headers: {
                'Content-Type': 'application/json',
                "Cache-Control": "no-cache",
                "Proxy-Connection": "keep-alive"
            }
        } as CreateAxiosDefaults);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT4:
                return 2500;
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
            temperature: 1,
            key: "",
            messages: [{role: 'user', content: req.prompt}],
            model: {
                "id": "gpt-4",
                "name": "GPT-4",
                "maxLength": 24000,
                "tokenLimit": 8000
            },
            prompt: "你是openai的gpt4模型，请回答我的问题"
        };
        try {
            const res = await this.client.post('/chat', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.on('end',()=>{
                stream.write(Event.done, {content: ''});
                stream.end();
            });
            res.data.pipe(es.map(async (chunk: any, cb: any) => {
                stream.write(Event.message, {content: chunk.toString()});
            }))
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }
    }
}
