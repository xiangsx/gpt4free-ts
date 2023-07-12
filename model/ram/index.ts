import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {ErrorData, Event, EventStream, MessageData, randomStr} from "../../utils";
import {v4} from "uuid";

interface Message {
    role: string;
    content: string;
}

interface RealReq {
    conversation_id: string;
    action: string;
    model: string;
    jailbreak: string;
    meta: Meta;
}

interface Meta {
    id: string;
    content: Content;
}

interface Content {
    conversation: ConversationItem[];
    internet_access: boolean;
    content_type: string;
    parts: Part[];
}

interface ConversationItem {
    role: string;
    content: string;
}

interface Part {
    content: string;
    role: string;
}

export class Ram extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://chat.ramxn.dev/backend-api',
            headers: {
                'Content-Type': 'application/json',
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
            }
        } as CreateAxiosDefaults);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT4:
                return 4000;
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
            action: "ask",
            conversation_id: v4(),
            jailbreak: "default",
            meta: {
                id: randomStr(15),
                content: {
                    content_type: "ask",
                    conversation: req.messages.slice(0, req.messages.length - 1),
                    internet_access: false,
                    parts: [req.messages[req.messages.length - 1]]
                }
            }, model: "gpt-4"
        };
        try {
            const res = await this.client.post('/v2/conversation', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.pipe(es.map(async (chunk: any, cb: any) => {
                stream.write(Event.message, {content: chunk.toString()})
            }))
            res.data.on('close',()=>{
                stream.write(Event.done, {content: ''})
                stream.end();
            })
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }
    }
}
