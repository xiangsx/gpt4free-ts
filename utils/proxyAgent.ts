import axios, {AxiosInstance, CreateAxiosDefaults} from "axios";
import HttpsProxyAgent from "https-proxy-agent";
import {SessionConstructorOptions} from "tls-client/dist/esm/types";
import {Session} from "tls-client/dist/esm/sessions";
import tlsClient from "tls-client";

export function CreateAxiosProxy(config: CreateAxiosDefaults, proxy?: string): AxiosInstance {
    const createConfig = {...config};
    const useProxy = process.env.http_proxy || proxy;
    if (useProxy) {
        createConfig.proxy = false;
        createConfig.httpAgent = HttpsProxyAgent(useProxy);
        createConfig.httpsAgent = HttpsProxyAgent(useProxy);
    }
    const client = axios.create(createConfig);
    if (process.env.REQ_PROXY) {
        client.interceptors.request.use(
            (config) => {
                config.params = {
                    ...config.params,
                    target: (config.baseURL || "") + (config.url || "")
                }
                config.baseURL = '';
                config.url = process.env.REQ_PROXY || '';
                return config;
            },
            error => {
                // 对请求错误做些什么
                return Promise.reject(error);
            }
        );
    }
    return client;
}

export function CreateTlsProxy(config: SessionConstructorOptions, proxy?: string): Session {
    const client = new tlsClient.Session(config);
    const useProxy = process.env.http_proxy || proxy;
    if (useProxy) {
        client.proxy = useProxy;
    }
    return client;
}
