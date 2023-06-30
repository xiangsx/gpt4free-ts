import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {ErrorData, Event, EventStream, MessageData, parseJSON} from "../../utils";

interface Message {
    role: string;
    content: string;
}

enum Model {
    Sage = 'capybara',
    Gpt4 = 'beaver',
    ClaudeInstance = 'a2',
    ClaudeP = 'a2_2',
    Claude100k = 'a2_100k',
    Gpt3p5Turbo = 'chinchilla',
}

const modelMap = {
    [ModelType.GPT4]: Model.Gpt4,
    [ModelType.ClaudeP]: Model.ClaudeP,
    [ModelType.GPT3p5Turbo]: Model.Gpt3p5Turbo,
    [ModelType.Claude100k]: Model.Claude100k,
} as Record<ModelType, Model>

interface RealReq {
    prompt: string;
    systemMessage: string;
    temperature: number;
    top_p: number;
    model: Model;
}

export interface RealRsp {
    role: string;
    id: string;
    parentMessageId: string;
    text: string;
    delta: string;
    detail: Detail;
}

interface Detail {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Choice[];
}

interface Choice {
    index: number;
    delta: Delta;
    finish_reason: any;
}

interface Delta {
    content: string;
}

export class PWeb extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://p.v50.ltd/api/',
            headers: {
                "Accept": "application/octet-stream",
                "Accept-Encoding": "gzip, deflate, br",
                'Pragma': 'no-cache',
                'Content-Type': 'application/json',
                "Cache-Control": "no-cache",
                "Proxy-Connection": "keep-alive",
            }
        } as CreateAxiosDefaults);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT3p5Turbo:
                return 2500;
            case ModelType.ClaudeP:
                return 10000;
            case ModelType.Claude100k:
                return 100 * 1000
            case ModelType.GPT4:
                return 8000;
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
                        result.content += (data as MessageData).content || '';
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
            model: modelMap[req.model] || Model.Gpt4,
            prompt: req.prompt,
            systemMessage: "You are GPT4.0, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown.",
            temperature: 1,
            top_p: 1
        };
        try {
            const res = await this.client.post('/chat-process', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.pipe(es.split(/\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                const data = parseJSON(chunk.toString(), {} as RealRsp);
                console.log("==", chunk);
                if (!data.delta) {
                    stream.write(Event.done, {content: data.delta || ''})
                    stream.end();
                    return;
                }
                stream.write(Event.message, {content: data.delta})
            }))
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }
    }
}
