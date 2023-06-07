import {Chat, ChatOptions} from "./base";
import {You} from "./you";
import {AiDream} from "./aidream";
import {Forefrontnew} from "./forefront";
import {Mcbbs} from "./mcbbs";

export enum Model {
    // define new model here
    You = 'you',
    Forefront = 'forefront',
    AiDream = 'aidream',
    Mcbbs = 'mcbbs',
}

export class ChatModelFactory {
    private modelMap: Map<Model, Chat>;
    private readonly options: ChatOptions | undefined;

    constructor(options?: ChatOptions) {
        this.modelMap = new Map();
        this.options = options;
        this.init();
    }

    init() {
        // register new model here
        this.modelMap.set(Model.You, new You(this.options))
        this.modelMap.set(Model.Forefront, new Forefrontnew(this.options))
        this.modelMap.set(Model.AiDream, new AiDream(this.options))
        this.modelMap.set(Model.Mcbbs, new Mcbbs(this.options))
    }

    get(model: Model): Chat | undefined {
        return this.modelMap.get(model);
    }
}
