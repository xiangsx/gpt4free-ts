import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {DoneData, ErrorData, Event, EventStream, MessageData, parseJSON} from "../../utils";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import es from "event-stream";

interface RealReq {
    prompt: string;
}

export class Bai extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://chatbot.theb.ai/api/',
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://chatbot.theb.ai",
            }
        } as CreateAxiosDefaults)
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT3p5Turbo:
                return 3000;
            default:
                return 0;
        }
    }

    public async ask(req: ChatRequest): Promise<ChatResponse> {
        const et = new EventStream();
        const res = await this.askStream(req, et);
        const result: ChatResponse = {
            content: '',
        };
        return new Promise(resolve => {
            et.read((event, data) => {
                if (!data) {
                    return;
                }
                switch (event) {
                    case 'message':
                        result.content += (data as MessageData).content;
                        break;
                    case 'done':
                        result.content += (data as DoneData).content;
                        break;
                    case 'error':
                        result.error = (data as ErrorData).error;
                        break;
                    default:
                        console.error(data);
                        break;
                }
            }, () => {
                resolve(result);
            });
        })
    }

    public async askStream(req: ChatRequest, stream: EventStream) {
        const data: RealReq = {
            prompt: req.prompt,
        };
        try {
            const res = await this.client.post('/chat-process', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            let old = '';
            res.data.pipe(es.split(/\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                try {
                    const dataStr = chunk.toString();
                    const data = parseJSON(dataStr, {} as any);
                    const {delta = ''} = data;
                    if (!delta) {
                        return;
                    }
                    stream.write(Event.message, {content: delta});
                } catch (e:any) {
                    console.error(e.message);
                }
            }))
            res.data.on('close', () => {
                stream.write(Event.done, {content: ''});
                stream.end();
            })
        } catch (e: any) {
            console.error(e.message);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }

    }
}
