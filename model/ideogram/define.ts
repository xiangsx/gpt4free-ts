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
  refresh_token: string;
  photo_url: string;
  uid: string;
  org_id: string;
  cookies: Protocol.Network.CookieParam[];
  sessCookies: Protocol.Network.CookieParam[];
  refresh_time: number;
  destroyed?: boolean;
  proxy?: string;
  ua?: string;
  apikey?: string;
  usage: ideogram.ImagesSamplingAvailableRes;
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
export enum StyleExpert {
  AUTO = 'AUTO',
  DEFAULT = 'DEFAULT',
  PHOTO = 'PHOTO',
  ILLUSTRATION = 'ILLUSTRATION',
  RENDER_3D = 'RENDER_3D',
  ANIME = 'ANIME',
}

export enum ModelVersion {
  V_1_5 = 'V_1_5',
}

enum AspectRatio {
  // PORTRAIT_1x3 = '512x1536',
  // PORTRAIT_1x2 = '704x1408',
  PORTRAIT_9x16 = '736x1312',
  PORTRAIT_10x16 = '800x1280',
  PORTRAIT_2x3 = '832x1248',
  PORTRAIT_3x4 = '864x1152',
  PORTRAIT_4x5 = '890x1120',

  // LANDSCAPE_3x1 = '1536x512',
  // LANDSCAPE_2x1 = '1408x704',
  LANDSCAPE_16x9 = '1312x736',
  LANDSCAPE_16x10 = '1280x800',
  LANDSCAPE_3x2 = '1248x832',
  LANDSCAPE_4x3 = '1152x864',
  LANDSCAPE_5x4 = '1120x890',

  SQUARE_1x1 = '1024x1024',
}

export declare namespace ideogram {
  interface Action {
    prompt: string;
    size: AspectRatio;
    style?: StyleExpert;
  }

  interface Resolution {
    width: number;
    height: number;
  }

  interface ColorPalette {
    color_hex: string;
  }

  interface ImagesSampleReq {
    prompt: string;
    user_id?: string;
    model_version: ModelVersion;
    use_autoprompt_option: string;
    sampling_speed: 0;
    style_expert: StyleExpert;
    resolution: Resolution;
    color_palette?: ColorPalette[];
  }

  interface ImagesSampleRes {
    user_id: string;
    caption: string;
    request_id: string;
    response_ids: string[];
    rejected_prompt_id: string | null;
    status: string | null;
    aspect_ratio: string;
    seed: number;
  }

  interface ImagesSamplingAvailableRes {
    allowed_to_generate: boolean;
    min_time_s_between_generations: number;
    time_until_next_generation: number;
    max_creations_per_day: number;
    num_standard_generations_today: number;
    sticky_balance: number;
    reject_reason: string | null;
    message: string | null;
  }

  interface ProviderData {
    providerId: string;
    uid: string;
    displayName: string;
    email: string;
    phoneNumber: string | null;
    photoURL: string;
  }

  interface StsTokenManager {
    refreshToken: string;
    accessToken: string;
    expirationTime: number;
  }

  interface User {
    uid: string;
    email: string;
    emailVerified: boolean;
    displayName: string;
    isAnonymous: boolean;
    photoURL: string;
    providerData: ProviderData[];
    stsTokenManager: StsTokenManager;
    createdAt: string;
    lastLoginAt: string;
    apiKey: string;
    appName: string;
  }

  interface TokenRefreshResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token: string;
    id_token: string;
    user_id: string;
    project_id: string;
  }

  interface SamplingRequest {
    aspect_ratio: string;
    can_upscale: boolean;
    completion_percentage: number;
    cover_response_id: string;
    creation_time_float: number;
    has_started: boolean;
    height: number;
    is_completed: boolean;
    model_version: string;
    private: boolean;
    request_id: string;
    request_type: string;
    resolution: number;
    responses: Response[];
    sampling_speed: number;
    seed: number;
    style_expert: string;
    user: User;
    user_hparams: UserHparams;
    user_prompt: string;
    width: number;
  }

  interface Response {
    cover: boolean;
    descriptions: string[];
    highest_fidelity: boolean;
    is_autoprompt: boolean;
    num_likes: number;
    num_remixes: number;
    prompt: string;
    response_id: string;
    url?: string;
    self_like: boolean;
    style_expert: string;
  }

  interface User {
    badge: string | null;
    display_handle: string;
    photo_url: string;
    subscription_plan_id: string | null;
    user_id: string;
  }

  interface UserHparams {
    aspect_ratio: string;
  }

  interface GalleryRetrieveRes {
    sampling_requests: SamplingRequest[];
  }

  interface EnabledFeatures {
    features: string[];
  }

  interface SubscriptionStatus {
    active_subscription: string | null;
    has_private_channel: string | null;
    no_active_subscription: boolean;
    subscription_quota: string | null;
  }

  interface UserModel {
    badge: string | null;
    display_handle: string;
    email_address: string;
    external_photo_url: string;
    recommended_display_handle: string | null;
    subscription_plan_id: string | null;
    tos_acceptance_required: boolean;
    user_id: string;
  }

  interface LoginRes {
    enabled_features: EnabledFeatures;
    subscription_status: SubscriptionStatus;
    user_model: UserModel;
  }
}
export const IdeogramPrompt = `
You are a image prompt maker for ideogram Image AI.
Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation.
Output json should be in code block format.

你需要根据用户的提示词生成如下格式的json
\`\`\`
{
  "prompt": "string", // 图片的详细描述，必须是英文的, 注意规避涉黄涉政的内容。
  "size": "string", // 不可自定义尺寸默认为 1024x1024，有特别说明的情况下，从以下尺寸中寻找最适合要求的尺寸 ${Object.values(
    AspectRatio,
  ).join('|')}
  "style"?: "string" // 默认不返回. 除非用户特别指定风格的时候从以下风格中选择最适合的 ${Object.values(
    StyleExpert,
  ).join('|')}
}
\`\`\`
`;
