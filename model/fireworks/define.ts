import { ComInfo } from '../../utils/pool';
import { Protocol } from 'puppeteer';
import { ModelType } from '../base';

export interface Account extends ComInfo {
  email: string;
  password: string;
  recovery: string;
  token: string;
  org_id: string;
  cookies: Protocol.Network.CookieParam[];
  refresh_time: number;
  destroyed?: boolean;
  proxy?: string;
  ua?: string;
  apikey?: string;
}

interface UserAuth {
  provider: string;
  provider_id: string;
}

interface Organization {
  object: string;
  id: string;
  created: number;
  name: string;
  description: string;
  personal: boolean;
  priority: number;
  verification_status: string;
  settings: Record<string, unknown>;
  role: string;
  tos_approved_at: number | null;
  tos_approved_by: number | null;
}

interface UserOrgs {
  object: string;
  data: Organization[];
}

interface User {
  object: string;
  id: string;
  name: string;
  email: string;
  picture: string;
  created: number;
  intercom_hash: string;
  auth: UserAuth;
  orgs: UserOrgs;
}

export interface ProfileRes {
  user: User;
}

export interface FireworksModel {
  id: string;
  model: ModelType;
  max_tokens: number;
  context_window: number;
}

export const FireworksModels: FireworksModel[] = [
  {
    id: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
    max_tokens: 16384,
    model: ModelType.Llama3_1_405b,
    context_window: 131072,
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    max_tokens: 16384,
    model: ModelType.Llama3_1_70b,
    context_window: 131072,
  },
  {
    id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
    max_tokens: 16384,
    model: ModelType.Llama3_1_8b,
    context_window: 131072,
  },
  {
    id: 'accounts/fireworks/models/llama-v3-70b-instruct',
    max_tokens: 4096,
    model: ModelType.Llama3_70b,
    context_window: 8192,
  },
];

export const FireworkModelMap: Record<string, FireworksModel> = {};
for (const v of FireworksModels) {
  FireworkModelMap[v.model] = v;
}

export function extractSecretKey(inputString: string) {
  const regex = /\\"key\\":\\"(.*?)\\"/;
  const match = inputString.match(regex);
  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
}

export function getFireworksModel(model: ModelType) {
  return FireworkModelMap[model];
}
