"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTlsProxy = exports.CreateAxiosProxy = void 0;
const axios_1 = __importDefault(require("axios"));
// import HttpsProxyAgent from 'https-proxy-agent'
const https_proxy_agent_1 = require("https-proxy-agent");
const tls_client_1 = __importDefault(require("tls-client"));
// const HttpsProxyAgent = require('https-proxy-agent')
function CreateAxiosProxy(config, proxy) {
    const createConfig = Object.assign({}, config);
    const useProxy = process.env.http_proxy || proxy;
    if (useProxy) {
        createConfig.proxy = false;
        createConfig.httpAgent = new https_proxy_agent_1.HttpsProxyAgent(useProxy);
        createConfig.httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(useProxy);
    }
    return axios_1.default.create(createConfig);
}
exports.CreateAxiosProxy = CreateAxiosProxy;
function CreateTlsProxy(config, proxy) {
    const client = new tls_client_1.default.Session(config);
    const useProxy = process.env.http_proxy || proxy;
    if (useProxy) {
        client.proxy = useProxy;
    }
    return client;
}
exports.CreateTlsProxy = CreateTlsProxy;
