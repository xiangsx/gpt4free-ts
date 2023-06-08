import {AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults} from 'axios';
import {md5, randomStr} from "./index";
import {CreateAxiosProxy} from "./proxyAgent";

export enum TempEmailType {
    // need credit card https://rapidapi.com/Privatix/api/temp-mail
    TempEmail = 'temp-email',
    // not need credit card , hard limit 100/day https://rapidapi.com/calvinloveland335703-0p6BxLYIH8f/api/temp-mail44
    TempEmail44 = 'temp-email44',
    // not need credit card and not need credit rapid_api_key
    TempMailLOL = 'tempmail-lol',
}

export function CreateEmail(tempMailType: TempEmailType, options?: BaseOptions): BaseEmail {
    switch (tempMailType) {
        case TempEmailType.TempEmail44:
            return new TempMail44(options);
        case TempEmailType.TempEmail:
            return new TempMail(options);
        case TempEmailType.TempMailLOL:
            return new TempMailLOL(options);
        default:
            throw new Error('not support TempEmailType')
    }
}

export interface BaseMailMessage {
    // main content of email
    content: string;
}

export interface TempMailMessage extends BaseMailMessage {
    _id: {
        oid: string;
    };
    createdAt: {
        milliseconds: number;
    };
    mail_id: string;
    mail_address_id: string;
    mail_from: string;
    mail_subject: string;
    mail_preview: string;
    mail_text_only: string;
    mail_text: string;
    mail_html: string;
    mail_timestamp: number;
    mail_attachments_count: number;
    mail_attachments: {
        attachment: any[];
    };
}

interface BaseOptions {
}

abstract class BaseEmail {
    protected constructor(options?: BaseOptions) {
    }

    public abstract getMailAddress(): Promise<string>

    public abstract waitMails(): Promise<BaseMailMessage[]>
}

export interface TempMailOptions extends BaseOptions {
    apikey?: string;
}

class TempMail extends BaseEmail {
    private readonly client: AxiosInstance;
    private address: string | undefined;
    private mailID: string = '';

    constructor(options?: TempMailOptions) {
        super(options)
        const apikey = options?.apikey || process.env.rapid_api_key;
        if (!apikey) {
            throw new Error('Need apikey for TempMail')
        }
        this.client = CreateAxiosProxy({
            baseURL: 'https://privatix-temp-mail-v1.p.rapidapi.com/request/',
            headers: {
                'X-RapidAPI-Key': apikey,
                'X-RapidAPI-Host': 'privatix-temp-mail-v1.p.rapidapi.com'
            }
        } as CreateAxiosDefaults);
    }

    public async getMailAddress(): Promise<string> {
        this.address = `${randomStr()}${await this.randomDomain()}`;
        this.mailID = md5(this.address);
        return this.address;
    }

    public async waitMails(): Promise<TempMailMessage[]> {
        const mailID = this.mailID;
        return new Promise(resolve => {
            let time = 0;
            const itl = setInterval(async () => {
                const response = await this.client.get(`/mail/id/${mailID}`);
                if (response.data && response.data.length > 0) {
                    resolve(response.data.map((item: any) => ({...item, content: item.mail_html})));
                    clearInterval(itl);
                    return;
                }
                if (time > 5) {
                    resolve([]);
                    clearInterval(itl);
                    return;
                }
                time++;
            }, 5000);
        });
    }

    async getDomainsList(): Promise<string[]> {
        const res = await this.client.get(`/domains/`);
        return res.data;
    }

    async randomDomain(): Promise<string> {
        const domainList = await this.getDomainsList();
        return domainList[Math.floor(Math.random() * domainList.length)];
    }
}

class TempMail44 extends BaseEmail {
    private readonly client: AxiosInstance;
    private address: string = '';

    constructor(options?: TempMailOptions) {
        super(options)
        const apikey = options?.apikey || process.env.rapid_api_key;
        if (!apikey) {
            throw new Error('Need apikey for TempMail')
        }
        this.client = CreateAxiosProxy({
            baseURL: 'https://temp-mail44.p.rapidapi.com/api/v3/email/',
            headers: {
                'X-RapidAPI-Key': apikey,
                'X-RapidAPI-Host': 'temp-mail44.p.rapidapi.com'
            }
        } as CreateAxiosDefaults);
    }

    public async getMailAddress(): Promise<string> {
        const response = await this.client.post('/new', {}, {
            headers: {
                'content-type': 'application/json',
            }
        } as AxiosRequestConfig);
        this.address = response.data.email;
        return this.address;
    }

    public async waitMails(): Promise<TempMailMessage[]> {
        return new Promise(resolve => {
            let time = 0;
            const itl = setInterval(async () => {
                const response = await this.client.get(`/${this.address}/messages`);
                if (response.data && response.data.length > 0) {
                    resolve(response.data.map((item: any) => ({...item, content: item.body_html})));
                    clearInterval(itl);
                    return;
                }
                if (time > 5) {
                    resolve([]);
                    clearInterval(itl);
                    return;
                }
                time++;
            }, 5000);
        });
    }
}

class TempMailLOL extends BaseEmail {
    private readonly client: AxiosInstance;
    private address: string = '';
    private token: string = '';

    constructor(options?: TempMailOptions) {
        super(options)
        this.client = CreateAxiosProxy({
            baseURL: 'https://api.tempmail.lol'
        } as CreateAxiosDefaults);
    }

    public async getMailAddress(): Promise<string> {
        const response = await this.client.get('/generate');
        this.address = response.data.address;
        this.token = response.data.token;
        return this.address;
    }

    public async waitMails(): Promise<TempMailMessage[]> {
        return new Promise(resolve => {
            let time = 0;
            const itl = setInterval(async () => {
                const response = await this.client.get(`/auth/${this.token}`);

                if (response.data && response.data.email.length > 0) {
                    resolve(response.data.email.map((item: any) => ({...item, content: item.html})));
                    clearInterval(itl);
                    return;
                }
                if (time > 5) {
                    resolve([]);
                    clearInterval(itl);
                    return;
                }
                time++;
            }, 5000);
        });
    }
}
