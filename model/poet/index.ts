import {Chat, ChatOptions, ChatRequest, ChatResponse, ModelType} from "../base";
import {Browser, EventEmitter, Page} from "puppeteer";
import {BrowserPool, BrowserUser} from "../../pool/puppeteer";
import {DoneData, ErrorData, Event, EventStream, MessageData, parseJSON} from "../../utils";
import {v4} from "uuid";
import moment from 'moment';
import TurndownService from 'turndown';

const turndownService = new TurndownService({codeBlockStyle: 'fenced'});

type PageData = {
    gpt4times: number;
}

const ModelMap: Partial<Record<ModelType, any>> = {
    [ModelType.GPT4]: 'GPT-4',
    [ModelType.Sage]: 'Sage',
    [ModelType.Claude]: 'Claude+',
    [ModelType.Claude100k]: 'Claude-instant-100k+',
    [ModelType.ClaudeInstance]: 'Claude-instant',
    [ModelType.GPT3p5Turbo]: 'ChatGPT',
    [ModelType.GPT3p5_16k]: 'ChatGPT-16k',
    [ModelType.Gpt4free]: '1GPT4Free',
    [ModelType.GooglePalm]: 'Google-PaLM',
    [ModelType.Claude2_100k]: 'Claude-2-100k',
    [ModelType.GPT4_32k]: 'GPT-4-32K',
}

const MaxGptTimes = 500;

const TimeFormat = "YYYY-MM-DD HH:mm:ss";

type Account = {
    id: string;
    email?: string;
    login_time?: string;
    last_use_time?: string;
    gpt4times: number;
    pb: string;
}

type HistoryData = {
    data: {
        query: string;
        result: string;
        created_at: string;
    }[]
}

interface Messages {
    id: string;
    messageId: number;
    creationTime: number;
    clientNonce: null;
    state: string;
    text: string;
    author: string;
    linkifiedText: string;
    contentType: string;
    attachments: any[];
    vote: null;
    suggestedReplies: string[];
    linkifiedTextLengthOnCancellation: null;
    textLengthOnCancellation: null;
    voteReason: null;
    __isNode: string;
}

interface Data {
    messageAdded: Messages;
}

interface Payload {
    unique_id: string;
    subscription_name: string;
    data: Data;
}

interface RootObject {
    message_type: string;
    payload: Payload;
}

interface RealAck {
    messages: string[];
    min_seq: number;
}

class PoeAccountPool {
    private pool: Account[] = [];
    private using = new Set<string>();

    constructor() {
        this.pool = (process.env.POE_PB || '').split('|').map(pb => ({
            id: v4(),
            gpt4times: 0,
            pb,
        } as Account));
    }

    public syncfile() {
    }

    public getByID(id: string) {
        for (const item of this.pool) {
            if (item.id === id) {
                return item;
            }
        }
    }

    public delete(id: string) {
        this.pool = this.pool.filter(item => item.id !== id);
        this.using.delete(id);
        this.syncfile();
    }

    public get(): Account {
        const now = moment();
        const usingAccount: Account[] = [];
        this.using.forEach(id => {
            const v = this.getByID(id);
            if (v) {
                usingAccount.push(v);
            }
        });
        for (const item of this.pool) {
            if (!usingAccount.find(v => item.pb === v.pb)) {
                this.using.add(item.id);
                return item;
            }
        }
        throw new Error('no new poe pb');
    }
}


export class Poe extends Chat implements BrowserUser<Account> {
    private pagePool: BrowserPool<Account>;
    private accountPool: PoeAccountPool;

    constructor(options?: ChatOptions) {
        super(options);
        this.accountPool = new PoeAccountPool();
        let maxSize = (process.env.POE_PB || '').split('|').length;
        this.pagePool = new BrowserPool<Account>(maxSize, this);
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
                return 6000;
            case ModelType.GPT3p5Turbo:
                return 3000;
            case ModelType.GPT3p5_16k:
                return 15000;
            case ModelType.Gpt4free:
                return 4000;
            case ModelType.Sage:
                return 4000;
            case ModelType.GooglePalm:
                return 4000;
            case ModelType.GPT4_32k:
                return 28000;
            case ModelType.Claude2_100k:
                return 80000
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
                        result.error += (data as ErrorData).error;
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

    deleteID(id: string): void {
        this.accountPool.delete(id);
    }

    newID(): string {
        const account = this.accountPool.get();
        return account.id;
    }

    async init(id: string, browser: Browser): Promise<[Page | undefined, Account]> {
        const account = this.accountPool.getByID(id);
        try {
            if (!account) {
                throw new Error("account undefined, something error");
            }
            const [page] = await browser.pages();
            await page.setCookie({name: 'p-b', value: account.pb, domain: 'poe.com'});
            await page.goto('https://poe.com')
            await page.waitForSelector(Poe.InputSelector, {timeout: 10 * 24 * 60 * 60 * 1000});
            // 输入邮箱
            await page.waitForSelector('.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .MainSignupLoginSection_inputAndMetaTextGroup__5ITsJ > .EmailInput_wrapper__D9Dss > .EmailInput_emailInput__4v_bn')
            await page.click('.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .MainSignupLoginSection_inputAndMetaTextGroup__5ITsJ > .EmailInput_wrapper__D9Dss > .EmailInput_emailInput__4v_bn')

            // 发送code
            await page.waitForSelector('body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn')
            await page.click('body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn')

            // 输入code
            await page.waitForSelector('.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .SignupOrLoginWithCodeSection_inputAndMetaTextGroup__ubLLI > .VerificationCodeInput_wrapper__ayRfN > .VerificationCodeInput_verificationCodeInput__YD3KV')
            await page.click('.LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .SignupOrLoginWithCodeSection_inputAndMetaTextGroup__ubLLI > .VerificationCodeInput_wrapper__ayRfN > .VerificationCodeInput_verificationCodeInput__YD3KV')

            // 提交code
            await page.waitForSelector('body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn')
            await page.click('body > #__next > .LoggedOutSection_main__QtksL > .LoggedOutSection_appSpecificSection__C5YEM > .Button_primary__pIDjn')
            return [page, account];
        } catch (e) {
            console.warn('something error happened,err:', e);
            return [] as any;
        }
    }

    public static async clear(page: Page) {
        await page.waitForSelector('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content', {timeout: 10 * 60 * 1000});
        await page.click('.ChatApp > .ChatFooter > .tool-bar > .semi-button:nth-child(1) > .semi-button-content')
    }

    public static InputSelector = '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .ChatMessageInputContainer_inputContainer__SQvPA > .GrowingTextArea_growWrap___1PZM > .GrowingTextArea_textArea__eadlu';
    public static ClearSelector = '.ChatPageMainFooter_footer__Hm4Rt > .ChatMessageInputFooter_footer__1cb8J > .Button_buttonBase__0QP_m > svg > path';
    public static EndFlag = '.PageWithSidebarLayout_mainSection__i1yOg > .ChatPageMain_container__1aaCT > .InfiniteScroll_container__kzp7X > .ChatMessagesView_messagePair__CsQMW > .ChatMessageFeedbackButtons_feedbackButtonsContainer__0Xd3I';

    public async askStream(req: ChatRequest, stream: EventStream) {
        // req.prompt = req.prompt.replace(/\n/g, ' ');
        const [page, account, done, destroy] = this.pagePool.get();
        if (page?.url().indexOf(ModelMap[req.model]) === -1) {
            await page?.goto(`https://poe.com/${ModelMap[req.model]}`, {waitUntil: 'networkidle0'});
        }
        if (!account || !page) {
            stream.write(Event.error, {error: 'please retry later!'});
            stream.end();
            return;
        }
        try {
            let old = '';
            const client = await page.target().createCDPSession();
            await client.send('Network.enable');
            let et: EventEmitter;
            const tt = setTimeout(async () => {
                if (et) {
                    et.removeAllListeners();
                }
                stream.write(Event.error, {error: 'timeout, try again later'});
                stream.end();
                done(account);
                await page.reload();
                console.error('poe wait ack ws timeout, reload page ok!');
            }, 30 * 1000)
            et = client.on('Network.webSocketFrameReceived', async ({response}) => {
                tt.refresh();
                const data = parseJSON(response.payloadData, {} as RealAck);
                const obj = parseJSON(data.messages[0], {} as RootObject);
                const message = obj?.payload?.data?.messageAdded;
                if (!message) {
                    return;
                }
                const {author, state, text} = message;
                if (author === 'human' || author === 'chat_break') {
                    return;
                }
                // console.log({author,state,text});
                switch (state) {
                    case 'complete':
                        clearTimeout(tt);
                        et.removeAllListeners();
                        stream.write(Event.message, {content: text.substring(old.length)});
                        stream.write(Event.done, {content: ''});
                        stream.end()
                        await page.waitForSelector(Poe.ClearSelector);
                        await page.click(Poe.ClearSelector);
                        done(account);
                        return;
                    case 'incomplete':
                        stream.write(Event.message, {content: text.substring(old.length)})
                        old = text;
                        return;
                }
            })
            await page.waitForSelector(Poe.ClearSelector);
            await page.click(Poe.ClearSelector);
            console.log('try to find input');
            await page.waitForSelector(Poe.InputSelector)
            await page.click(Poe.InputSelector);
            await page.type(Poe.InputSelector, `1`);
            const input = await page.$(Poe.InputSelector);
            //@ts-ignore
            await input?.evaluate((el, content) => el.value = content, req.prompt);
            await page.keyboard.press('Enter');
            console.log('send msg ok!');
        } catch (e) {
            console.error("poe ask stream failed:", e);
            console.error(`failed account: pb=${account.pb}`);
            done(account);
            stream.write(Event.error, {error: 'some thing error, try again later'});
            stream.end();
            return
        }
    }
}
