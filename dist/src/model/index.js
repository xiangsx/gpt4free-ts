"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModelFactory = exports.Model = void 0;
const you_1 = require("./you");
const aidream_1 = require("./aidream");
const forefront_1 = require("./forefront");
const mcbbs_1 = require("./mcbbs");
var Model;
(function (Model) {
    // define new model here
    Model["You"] = "you";
    Model["Forefront"] = "forefront";
    Model["AiDream"] = "aidream";
    Model["Mcbbs"] = "mcbbs";
})(Model = exports.Model || (exports.Model = {}));
class ChatModelFactory {
    constructor(options) {
        this.modelMap = new Map();
        this.options = options;
        this.init();
    }
    init() {
        // register new model here
        this.modelMap.set(Model.You, new you_1.You(this.options));
        this.modelMap.set(Model.Forefront, new forefront_1.Forefrontnew(this.options));
        this.modelMap.set(Model.AiDream, new aidream_1.AiDream(this.options));
        this.modelMap.set(Model.Mcbbs, new mcbbs_1.Mcbbs(this.options));
    }
    get(model) {
        return this.modelMap.get(model);
    }
}
exports.ChatModelFactory = ChatModelFactory;
