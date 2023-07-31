import {Chat, ChatRequest, ChatResponse, ModelType, Site} from "./base";
import {EventStream} from "../utils";
import {BaseOptions} from "vm";

interface AutoOptions extends BaseOptions {
    ModelMap: Map<Site, Chat>;
}

type SiteCfg = {
    site: Site;
    priority: number;
}

type ModelSiteMap = Map<ModelType, SiteCfg[]>;

const siteMap: ModelSiteMap = new Map([
    [ModelType.GPT4, [
        {site: Site.Poe, priority: 50},
        {site: Site.Cursor, priority: 20}
    ]
    ],
    [ModelType.GPT3p5Turbo, [
        {site: Site.Bai, priority: 50},
        {site: Site.Copilot, priority: 50},
        {site: Site.PWeb, priority: 30},
        {site: Site.Chur, priority: 0},
        {site: Site.Poe, priority: 1},
        {site: Site.Cursor, priority: 10},
    ],
    ],
    [ModelType.GPT3p5_16k, [
        {site: Site.Chur, priority: 10},
        {site: Site.Poe, priority: 40},
    ]],
])

function randomPick(list: SiteCfg[]): Site {
    let sum = 0;
    for (const item of list) {
        sum += item.priority;
    }

    let rand = Math.random() * sum;
    for (let i = 0; i < list.length; i++) {
        rand -= list[i].priority;
        if (rand < 0) {
            return list[i].site;
        }
    }

    return Site.Claude; // 如果没有元素，返回null
}

export class Auto extends Chat {
    private modelMap: Map<Site, Chat>;

    constructor(options: AutoOptions) {
        super(options);
        this.modelMap = options.ModelMap;
    }

    getRandomModel(model: ModelType): Chat {
        const site = randomPick(siteMap.get(model) || []);
        console.log(`auto site choose site ${site}`);
        return this.modelMap.get(site) as Chat;
    }

    ask(req: ChatRequest): Promise<ChatResponse> {
        return this.getRandomModel(req.model).ask(req);
    }

    askStream(req: ChatRequest, stream: EventStream): Promise<void> {
        return this.getRandomModel(req.model).askStream(req, stream);
    }

    support(model: ModelType): number {
        switch (model) {
            case ModelType.GPT4:
                return 6000;
            case ModelType.GPT3p5Turbo:
                return 3000;
            case ModelType.GPT3p5_16k:
                return 12000;
            default:
                return 0;
        }
    }

}
