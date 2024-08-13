import { ComInfo } from '../../utils/pool';
import { Protocol } from 'puppeteer';
import { DefaultRedis, StringCache } from '../../utils/cache';
import { CreateNewAxios } from '../../utils/proxyAgent';
import { HeadersDefaults } from 'axios';
import moment from 'moment/moment';

export interface Account extends ComInfo {
  email: string;
  password: string;
  recovery: string;
  token: string;
  org_id: string;
  cookies: Protocol.Network.CookieParam[];
  sessCookies: Protocol.Network.CookieParam[];
  refresh_time: number;
  destroyed?: boolean;
  proxy?: string;
  ua?: string;
  apikey?: string;
}

export interface PredictionsReq {
  prompt: string;
  height: number;
  width: number;
}

export interface PredictionsRes {
  message: string;
  replicateId: string;
}

export interface ResultRes {
  status: 1;
  message: 'success';
  imgAfterSrc: string;
}

export const FluxServerCache = new StringCache<string>(
  DefaultRedis,
  'flux_id_server',
  24 * 60 * 60,
);

export const FluxPrompt = `
You are a image prompt maker for flux Image AI.
Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation.
Output json should be in code block format.

你需要根据用户的提示词生成如下格式的json
\`\`\`
{
  "prompt": "string", // 图片的详细描述，必须是英文的, 注意规避涉黄涉政的内容。
  "height": 256|512|1024|1280|1440, // 默认 1440 图片的高度 注意只能从这几个值中选择 
  "width": 256|512|1024|1280|1440, , // 默认 1440 图片的高度 注意只能从这几个值中选择
}
\`\`\`
`;

export class ClertAuth {
  sessClient: any;
  private sid!: string;

  constructor(
    private base_url: string,
    private client: string,
    private version: string,
    private ua: string,
    private proxy: string,
  ) {
    this.sessClient = CreateNewAxios(
      {
        baseURL: `https://clerk.${base_url}`,
        headers: {
          'User-Agent': ua,
          Cookie: `__client=${client};`,
          pragma: 'no-cache',
          Origin: `https://${base_url}`,
          Referer: `https://${base_url}/`,
        },
        timeout: 30 * 1000,
      },
      {
        proxy,
      },
    );
  }

  async updateSID() {
    let res: {
      data: {
        response: {
          sessions: { id: string }[];
        };
      };
    } = await this.sessClient.get(
      `/v1/client?_clerk_js_version=${this.version}`,
    );
    const sid = res.data?.response?.sessions?.[0]?.id;
    if (!sid) {
      throw new Error('sid not found');
    }
    this.sid = sid;
  }

  async getToken() {
    if (!this.sid) {
      await this.updateSID();
    }
    let res: { data: { jwt: string } } = await this.sessClient.post(
      `/v1/client/sessions/${this.sid}/tokens?_clerk_js_version=${this.version}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: `https://${this.base_url}`,
          Referer: `https://${this.base_url}/`,
        },
      },
    );
    const jwt = res.data?.jwt;
    if (!jwt) {
      throw new Error('jwt not found');
    }
    return jwt;
  }
}
