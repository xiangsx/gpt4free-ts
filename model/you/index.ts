import {v4 as uuidv4} from 'uuid';
//@ts-ignore
import UserAgent from 'user-agents';
import {Session} from "tls-client/dist/esm/sessions";
import {Params} from "tls-client/dist/esm/types";
import {parseJSON, toEventCB, toEventStream} from "../../utils";
import {Chat, ChatOptions, Request, Response, ResponseStream} from "../base";
import {CreateTlsProxy} from "../../utils/proxyAgent";

const userAgent = new UserAgent();

interface IRequestOptions {
    page?: number;
    count?: number;
    safeSearch?: string;
    onShoppingPage?: string;
    mkt?: string;
    responseFilter?: string;
    domain?: string;
    queryTraceId?: string | null;
    chat?: any[] | null;
    includeLinks?: string;
    detailed?: string;
    debug?: string;
    proxy?: string | null;
}

interface SearchResult {
    search: {
        third_party_search_results: {
            name: string,
            url: string,
            displayUrl: string,
            snippet: string,
            language: null | string,
            thumbnailUrl: string,
            isFamilyFriendly: null | boolean,
            isNavigational: null | boolean,
            snmix_link: null | string
        }[],
        rankings: {
            pole: null,
            sidebar: null,
            mainline: {
                answerType: string,
                resultIndex: number,
                value: {
                    id: string
                }
            }[]
        },
        query_context: {
            spelling: null,
            originalQuery: string
        },
        third_party_web_results_source: number
    },
    time: number,
    query: string,
    exactAbTestSlices: {
        abUseQueryRewriter: string
    }
}

export class You extends Chat {
    private session: Session;

    constructor(props?: ChatOptions) {
        super(props);
        this.session = CreateTlsProxy({clientIdentifier: 'chrome_108'});
        this.session.headers = this.getHeaders();
    }

    private async request(req: Request) {
        let {
            page = 1,
            count = 10,
            safeSearch = 'Moderate',
            onShoppingPage = 'False',
            mkt = '',
            responseFilter = 'WebPages,Translations,TimeZone,Computation,RelatedSearches',
            domain = 'youchat',
            queryTraceId = null,
            chat = null,
            includeLinks = "False",
            detailed = "False",
            debug = "False",
        } = req.options || {};
        if (!chat) {
            chat = [];
        }
        return await this.session.get(
            'https://you.com/api/streamingSearch', {
                params: {
                    q: req.prompt,
                    page: page + '',
                    count: count + '',
                    safeSearch: safeSearch + '',
                    onShoppingPage: onShoppingPage + '',
                    mkt: mkt + '',
                    responseFilter: responseFilter + '',
                    domain: domain + '',
                    queryTraceId: queryTraceId || uuidv4(),
                    chat: JSON.stringify(chat),
                } as Params,
            }
        );
    }

    public async askStream(req: Request): Promise<ResponseStream> {
        const response = await this.request(req);
        return {text: toEventStream(response.content), other: {}}
    }

    public async ask(
        req: Request): Promise<Response> {
        const response = await this.request(req);
        return new Promise(resolve => {
            const res: Response = {
                text: '',
                other: {},
            };
            toEventCB(response.content, (eventName, data) => {
                let obj: any;
                switch (eventName) {
                    case 'youChatToken':
                        obj = parseJSON(data, {}) as any;
                        res.text += obj.youChatToken;
                        break;
                    case 'done':
                        resolve(res);
                        return;
                    default:
                        obj = parseJSON(data, {}) as any;
                        res.other[eventName] = obj;
                        return;
                }
            });
        })
    }

    getHeaders(): { [key: string]: string } {
        return {
            authority: 'you.com',
            accept: 'text/event-stream',
            'accept-language': 'en,fr-FR;q=0.9,fr;q=0.8,es-ES;q=0.7,es;q=0.6,en-US;q=0.5,am;q=0.4,de;q=0.3',
            'cache-control': 'no-cache',
            referer: 'https://you.com/search?q=who+are+you&tbm=youchat',
            'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            cookie: `safesearch_guest=Moderate; uuid_guest=${uuidv4()}`,
            'user-agent': userAgent.toString(),
        };
    }
}
