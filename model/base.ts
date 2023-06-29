import {EventStream, getTokenSize} from "../utils";

export interface ChatOptions {
}

export interface ChatResponse {
    content?: string;
    error?: string;
}

export type Message = {
    role: string;
    content: string;
}

export enum ModelType {
    GPT3p5Turbo = 'gpt3.5-turbo',
    GPT3p5_16k = 'gpt-3.5-turbo-16k',
    GPT4 = 'gpt4',
    NetGpt3p5 = 'net-gpt3.5-turbo',
    ClaudeP = 'claudep',
}

export interface ChatRequest {
    prompt: string;
    model: ModelType;
}

export function PromptToString(prompt: string, limit: number): string {
    try {
        const messages: Message[] = JSON.parse(prompt);
        const res = `${messages.map(item => `${item.role}: ${item.content}`).join('\n')}\nassistant: `;
        console.log(prompt.length, limit, getTokenSize(res));
        if (getTokenSize(res) >= limit && messages.length > 1) {
            return PromptToString(JSON.stringify(messages.slice(1, messages.length)), limit);
        }
        return res;
    } catch (e) {
        return prompt;
    }
}

export abstract class Chat {
    protected options: ChatOptions | undefined;

    protected constructor(options?: ChatOptions) {
        this.options = options;
    }

    public abstract support(model: ModelType): number

    public abstract ask(req: ChatRequest): Promise<ChatResponse>

    public abstract askStream(req: ChatRequest, stream: EventStream): Promise<void>
}
