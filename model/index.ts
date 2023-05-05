import {Chat, ChatOptions} from "./base";
import {You} from "./you";

export enum Model {
    // define new model here
    You = 'you',
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
    }

    get(model: Model): Chat | undefined {
        return this.modelMap.get(model);
    }
}
