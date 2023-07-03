import {Chat, ChatOptions, ModelType} from "./base";
import {You} from "./you";
import {Mcbbs} from "./mcbbs";
import {ChatDemo} from "./chatdemo";
import {Phind} from "./phind";
import {Forefrontnew} from "./forefront";
import {Vita} from "./vita";
import {Copilot} from "./copilot";
import {Skailar} from "./skailar";
import {FakeOpen} from "./fakeopen";
import {EasyChat} from "./easychat";
import {Better} from "./better";
import {PWeb} from "./pweb";
import {Bai} from "./bai";

export enum Site {
    // define new model here
    You = 'you',
    Phind = 'phind',
    Forefront = 'forefront',
    ForefrontClaudeP = 'forefront_claudep',
    Mcbbs = 'mcbbs',
    ChatDemo = 'chatdemo',
    Vita = 'vita',
    Copilot = 'copilot',
    Skailar = 'skailar',
    FakeOpen = 'fakeopen',
    EasyChat = 'easychat',
    Better = 'better',
    PWeb = 'pweb',
    Bai = 'bai',
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
        this.modelMap.set(Site.Skailar, new Skailar(this.options))
        this.modelMap.set(Site.FakeOpen, new FakeOpen(this.options))
        this.modelMap.set(Site.EasyChat, new EasyChat({...this.options, model: ModelType.GPT4}))
        this.modelMap.set(Site.Better, new Better(this.options))
        this.modelMap.set(Site.PWeb, new PWeb(this.options))
        this.modelMap.set(Site.Bai, new Bai(this.options))
    }

    get(model: Site): Chat | undefined {
        return this.modelMap.get(model);
    }
}
