import {Chat, ChatOptions, ModelType} from "./base";
import {You} from "./you";
import {Mcbbs} from "./mcbbs";
import {ChatDemo} from "./chatdemo";
import {Phind} from "./phind";
import {Forefrontnew} from "./forefront";
import {Vita} from "./vita";
import {Copilot} from "./copilot";

export enum Site {
    // define new model here
    You = 'you',
    Phind = 'phind',
    Forefront = 'forefront',
    ForefrontClaudeP = 'forefront_claudep',
    Mcbbs = 'mcbbs',
    ChatDemo = 'chatdemo',
    Vita = 'vita',
    Copilot = 'copilot'
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
        this.modelMap.set(Site.Phind, new Phind(this.options))
        this.modelMap.set(Site.ForefrontClaudeP, new Forefrontnew({...this.options, model: ModelType.ClaudeP}))
        this.modelMap.set(Site.Forefront, new Forefrontnew({...this.options, model: ModelType.GPT4}))
        this.modelMap.set(Site.Mcbbs, new Mcbbs(this.options))
        this.modelMap.set(Site.ChatDemo, new ChatDemo(this.options))
        this.modelMap.set(Site.Vita, new Vita(this.options))
        this.modelMap.set(Site.Copilot, new Copilot({...this.options, model: ModelType.GPT4}))
    }

    get(model: Site): Chat | undefined {
        return this.modelMap.get(model);
    }
}
