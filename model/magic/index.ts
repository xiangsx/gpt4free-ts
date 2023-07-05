import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import {ErrorData, Event, EventStream, MessageData} from "../../utils";

interface Message {
    role: string;
    content: string;
}

interface ModelInfo {
    id: string;
    name: string;
}

const modelMap = {
    [ModelType.ClaudeInstance]: {
        id: "claude-instant",
        name: "CLAUDE-INSTANT"
    },
    [ModelType.Claude100k]: {
        id: "claude-instant-100k",
        name: "CLAUDE-INSTANT-100K"
    },
    [ModelType.Claude]: {
        id: "claude+",
        name: "CLAUDE+"
    },
    [ModelType.GPT4]: {
        id: "gpt-4",
        name: "GPT-4"
    },
    [ModelType.GPT3p5Turbo]: {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5-TURBO"
    },
} as Record<ModelType, ModelInfo>

interface Message {
    role: string;
    content: string;
}

interface RealReq {
    model: ModelInfo;
    messages: Message[];
    key: string;
    prompt: string;
    temperature: number;
}

export class Magic extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://magic.ninomae.top/api',
            headers: {
                'Content-Type': 'application/json'
            }
        } as CreateAxiosDefaults);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.ClaudeInstance:
                return 4000;
            case ModelType.Claude100k:
                return 50000;
            case ModelType.Claude:
                return 4000;
            case ModelType.GPT4:
                return 8000;
            case ModelType.GPT3p5Turbo:
                return 4000;
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
            key: "",
            prompt: "",
            messages: [{role: 'user', content: req.prompt}],
            model: modelMap[req.model],
            temperature: 1
        };
        try {
            const res = await this.client.post('/chat', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.on('data', (chunk: any) => {
                stream.write(Event.message, {content: chunk.toString()});
            })
            res.data.on('close', () => {
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
