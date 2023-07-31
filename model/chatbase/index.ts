import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {CreateAxiosProxy} from "../../utils/proxyAgent";
import es from "event-stream";
import {ErrorData, Event, EventStream, MessageData, randomStr} from "../../utils";

export class ChatBase extends Chat {
    private client: AxiosInstance;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = CreateAxiosProxy({
            baseURL: 'https://www.chatbase.co/api',
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
                return 3000;
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
        const data = {
            "messages": req.messages,
            "captchaCode": "hadsa",
            "chatId": "chatbase--1--pdf-p680fxvnm",
            "conversationId": `y4-${randomStr(10)}-chatbase--1--pdf-p680fxvnm`
        };
        try {
            const res = await this.client.post('/fe/chat', data, {
                responseType: 'stream',
            } as AxiosRequestConfig);
            res.data.pipe(es.map(async (chunk: any, cb: any) => {
                const content = chunk.toString();
                if (!content) {
                    return;
                }
                stream.write(Event.message, {content});
            }))
            res.data.on('close', () => {
                stream.write(Event.done, {content: ''});
                stream.end();
            })
        } catch (e: any) {
            console.error(e);
            stream.write(Event.error, {error: e.message})
            stream.end();
        }
    }
}
