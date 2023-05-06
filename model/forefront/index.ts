//@ts-ignore
import UserAgent from 'user-agents';
import tlsClient from 'tls-client';

import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {Email} from '../../utils/email';
import axios, {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from "axios";
import {v4} from "uuid";
import es from "event-stream";
import {encryptWithAes256Cbc, parseJSON} from "../../utils";

interface ForefrontRequest extends Request {
    options?: {
        chatId?: string;
        prompt?: string;
        actionType?: string;
        defaultPersona?: string;
        model?: string;
    }
}

interface ChatCompletionChoice {
    delta: {
        content: string;
    };
    index: number;
    finish_reason: string | null;
}

interface ChatCompletionChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
}

interface ForefrontSessionInfo {
    agent: string;
    token: string;
    sessionID: string;
    userID: string;
}

export class Forefront extends Chat {
    private client: AxiosInstance | undefined;
    private session: ForefrontSessionInfo | undefined;

    constructor(options?: ChatOptions) {
        super(options);
        this.client = undefined;
        this.session = undefined;
    }

    public async ask(req: ForefrontRequest): Promise<Response> {
        const res = await this.askStream(req);
        let text = '';
        return new Promise(resolve => {
            res.text.pipe(es.split(/\r?\n\r?\n/)).pipe(es.map(async (chunk: any, cb: any) => {
                const str = chunk.replace('data: ', '');
                if (!str || str === '[DONE]') {
                    cb(null, false);
                    return;
                }
                const data = parseJSON(str, {}) as ChatCompletionChunk;
                if (!data.choices) {
                    cb(null, '');
                    return;
                }
                const [{delta: {content}}] = data.choices;
                cb(null, content);
            })).on('data', (data) => {
                if (!data) {
                    return;
                }
                text += data;
            }).on('close', () => {
                resolve({text, other: res.other});
            })
        })

    }

    public async askStream(req: Request): Promise<ResponseStream> {
        if (!this.client) {
            await this.initClient();
        }
        if (!this.client || !this.session) {
            throw new Error('hava not created account');
        }
        const {
            chatId = v4(),
            actionType = 'new',
            defaultPersona = '607e41fe-95be-497e-8e97-010a59b2e2c0',
            model = 'gpt-4',
        } = req.options || {};
        const jsonData = {
            text: req.prompt,
            action: actionType,
            parentId: chatId,
            workspaceId: chatId,
            messagePersona: defaultPersona,
            model: model,
        };
        const base64Data = Buffer.from(this.session.userID + defaultPersona + chatId).toString('base64');
        const encryptedSignature = encryptWithAes256Cbc(base64Data, this.session.sessionID);

        try {
            const response = await this.client?.post(
                'https://streaming.tenant-forefront-default.knative.chi.coreweave.com/chat', jsonData,
                {
                    responseType: 'stream', headers: {'x-signature': encryptedSignature}
                } as AxiosRequestConfig
            );
            return {text: response.data};
        } catch (e) {// session will expire very fast, I cannot know what reason
            throw e;
        }
    }

    async initClient() {
        let hisSession = await this.createToken();
        this.session = hisSession;
        this.client = axios.create({
            headers: {
                'authority': 'chat-server.tenant-forefront-default.knative.chi.coreweave.com',
                'accept': '*/*',
                'accept-language': 'en,fr-FR;q=0.9,fr;q=0.8,es-ES;q=0.7,es;q=0.6,en-US;q=0.5,am;q=0.4,de;q=0.3',
                'authorization': 'Bearer ' + hisSession.token,
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'origin': 'https://chat.forefront.ai',
                'pragma': 'no-cache',
                'referer': 'https://chat.forefront.ai/',
                'sec-ch-ua': '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': hisSession.agent,
            }
        } as CreateAxiosDefaults);
    }

    async createToken(): Promise<ForefrontSessionInfo> {
        const mailbox = new Email();
        const mailAddress = await mailbox.create();
        const agent = new UserAgent().toString();
        const session = new tlsClient.Session({clientIdentifier: 'chrome_108'});
        session.headers = {
            origin: 'https://accounts.forefront.ai',
            'user-agent': agent, // Replace with actual random user agent
        }
        if (this.proxy) {
            session.proxy = this.proxy;
        }
        const signEmailRes = await session.post('https://clerk.forefront.ai/v1/client/sign_ups?_clerk_js_version=4.38.4',
            {data: {'email_address': mailAddress}});
        const traceToken = (signEmailRes.data as any)?.response?.id;
        if (!traceToken) {
            throw new Error('Failed to create account! sign email res parse token failed!');
        }

        const verifyRes = await session.post(`https://clerk.forefront.ai/v1/client/sign_ups/${traceToken}/prepare_verification?_clerk_js_version=4.38.4`, {
            data: {
                'strategy': 'email_link',
                'redirect_url': 'https://accounts.forefront.ai/sign-up/verify'
            },
        })
        if (verifyRes.text.indexOf('sign_up_attempt') === -1) {
            throw new Error('forefront create account failed');
        }
        const msgs = await mailbox.getMessage()
        let validateURL: string | undefined;
        for (const msg of msgs) {
            validateURL = msg.mail_html.match(/https:\/\/clerk\.forefront\.ai\/v1\/verify\?token=[^\s"]+/i)?.[0];
            if (validateURL) {
                break;
            }
        }
        if (!validateURL) {
            throw new Error('Error while obtaining verfication URL!')
        }
        const validateRes = await session.get(validateURL)
        const loginRes = await session.get('https://clerk.forefront.ai/v1/client?_clerk_js_version=4.38.4');
        const token = (loginRes.data as any).response.sessions[0].last_active_token.jwt;
        const sessionID = (loginRes.data as any).response.sessions[0].id
        const userID = (loginRes.data as any).response.sessions[0].user.id
        return {token, agent, sessionID, userID};
    }
}
