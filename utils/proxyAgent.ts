import axios, {AxiosInstance, CreateAxiosDefaults} from "axios";
import HttpsProxyAgent from "https-proxy-agent";
import {SessionConstructorOptions} from "tls-client/dist/esm/types";
import {Session} from "tls-client/dist/esm/sessions";
import tlsClient from "tls-client";

const reqProxy = (config: any) => {
    config.params = {
        ...config.params,
        target: (config.baseURL || "") + (config.url || "")
    }
    config.baseURL = '';
    config.url = process.env.REQ_PROXY || '';
    return config;
}

export function CreateAxiosProxy(config: CreateAxiosDefaults, proxy?: string): AxiosInstance {
    const createConfig = {...config};
    const useProxy = process.env.http_proxy || proxy;
    if (useProxy) {
        createConfig.proxy = false;
        createConfig.httpAgent = HttpsProxyAgent(useProxy);
        createConfig.httpsAgent = HttpsProxyAgent(useProxy);
    }
    const client = axios.create(createConfig);
    const retryClient = axios.create(createConfig);
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
    if (process.env.RETRY === "1") {
        client.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
            // 如果请求失败并且重试次数少于一次，则重试
            if (err) {
                // 返回 axios 实例，进行一次新的请求
                console.log('axios failed, retrying!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
                return retryClient(err.config);
            }

            // 如果失败且重试达到最大次数，将错误返回到用户
            return Promise.reject(err);
        });
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
