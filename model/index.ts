import {Chat, ChatOptions} from "./base";
import {You} from "./you";
import {Forefrontnew} from "./forefront";
import {Mcbbs} from "./mcbbs";
import {ChatDemo} from "./chatdemo";

export enum Site {
    // define new model here
    You = 'you',
    Forefront = 'forefront',
    Mcbbs = 'mcbbs',
    ChatDemo = 'chatdemo',
}

export class ChatModelFactory {
    private modelMap: Map<Site, Chat>;
    private readonly options: ChatOptions | undefined;

    constructor(options?: ChatOptions) {
        this.modelMap = new Map();
        this.options = options;
        this.init();
    }

    init() {
        // register new model here
        this.modelMap.set(Site.You, new You(this.options))
        this.modelMap.set(Site.Forefront, new Forefrontnew(this.options))
        this.modelMap.set(Site.Mcbbs, new Mcbbs(this.options))
        this.modelMap.set(Site.ChatDemo, new ChatDemo(this.options))
    }

    get(model: Site): Chat | undefined {
        return this.modelMap.get(model);
    }
}
