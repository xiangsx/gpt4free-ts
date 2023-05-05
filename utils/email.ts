import axios, {AxiosInstance, CreateAxiosDefaults} from 'axios';
import {md5, randomStr} from "./index";

export class Email {
    private mail: TempMail;
    private address: string | undefined;
    private domainList: string[];
    private mailID: string;

    constructor() {
        this.mail = new TempMail(process.env.rapid_api_key || "");
        this.address = undefined;
        this.mailID = '';
        this.domainList = [];
    }

    async create(): Promise<any> {
        this.domainList = await this.mail.getDomainsList();
        this.address = `${randomStr()}${this.randomDomain()}`;
        this.mailID = md5(this.address);
        return this.address;
    }

    randomDomain(): string {
        return this.domainList[Math.floor(Math.random() * this.domainList.length)];
    }

    emailAddress() {
        if (!this.address) {
            throw new Error('create first');
        }
        return this.address;
    }

    async getMessage() {
        return this.mail.getEmail(this.mailID);
    }
}

interface TempMailMessage {
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

class TempMail {
    private readonly client: AxiosInstance;

    constructor(apikey: string) {
        this.client = axios.create({
            baseURL: 'https://privatix-temp-mail-v1.p.rapidapi.com/request/',
            headers: {
                'X-RapidAPI-Key': apikey,
                'X-RapidAPI-Host': 'privatix-temp-mail-v1.p.rapidapi.com'
            }
        } as CreateAxiosDefaults);
    }

    async getEmail(md5Str: string): Promise<TempMailMessage[]> {
        return new Promise(resolve => {
            let time = 0;
            const itl = setInterval(async () => {
                const response = await this.client.get(`/mail/id/${md5Str}`);
                if (response.data && response.data.length > 0) {
                    resolve(response.data);
                    clearInterval(itl);
                    return;
                }
                if (time > 5) {
                    resolve([]);
                    clearInterval(itl);
                    return;
                }
                time++;
            }, 1000);
        });
    }

    async getDomainsList(): Promise<string[]> {
        const res = await this.client.get(`/domains/`);
        return res.data;
    }
}
