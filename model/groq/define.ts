import { ComInfo } from '../../utils/pool';
import { Protocol } from 'puppeteer';
import exp from 'constants';
import { CommCache, DefaultRedis, StringCache } from '../../utils/cache';
import { GizmoInfo } from '../openchat4/define';

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

export interface GroqModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  active: boolean;
  context_window: number;
  public_apps: string[] | null;
}

export const GroqModels: GroqModel[] = [
  {
    id: 'gemma2-9b-it',
    object: 'model',
    created: 1693721698,
    owned_by: 'Google',
    active: true,
    context_window: 8192,
    public_apps: null,
  },
  {
    id: 'gemma-7b-it',
    object: 'model',
    created: 1693721698,
    owned_by: 'Google',
    active: true,
    context_window: 8192,
    public_apps: null,
  },
  {
    id: 'llama-3.1-405b-reasoning',
    object: 'model',
    created: 1693721698,
    owned_by: 'Meta',
    active: true,
    context_window: 131072,
    public_apps: ['chat'],
  },
  {
    id: 'llama-3.1-70b-versatile',
    object: 'model',
    created: 1693721698,
    owned_by: 'Meta',
    active: true,
    context_window: 131072,
    public_apps: null,
  },
  {
    id: 'llama-3.1-8b-instant',
    object: 'model',
    created: 1693721698,
    owned_by: 'Meta',
    active: true,
    context_window: 131072,
    public_apps: null,
  },
  {
    id: 'llama3-70b-8192',
    object: 'model',
    created: 1693721698,
    owned_by: 'Meta',
    active: true,
    context_window: 8192,
    public_apps: null,
  },
  {
    id: 'llama3-8b-8192',
    object: 'model',
    created: 1693721698,
    owned_by: 'Meta',
    active: true,
    context_window: 8192,
    public_apps: null,
  },
  {
    id: 'llama3-groq-70b-8192-tool-use-preview',
    object: 'model',
    created: 1693721698,
    owned_by: 'Groq',
    active: true,
    context_window: 8192,
    public_apps: null,
  },
  {
    id: 'llama3-groq-8b-8192-tool-use-preview',
    object: 'model',
    created: 1693721698,
    owned_by: 'Groq',
    active: true,
    context_window: 8192,
    public_apps: null,
  },
  {
    id: 'mixtral-8x7b-32768',
    object: 'model',
    created: 1693721698,
    owned_by: 'Mistral AI',
    active: true,
    context_window: 32768,
    public_apps: null,
  },
  {
    id: 'whisper-large-v3',
    object: 'model',
    created: 1693721698,
    owned_by: 'OpenAI',
    active: true,
    context_window: 1500,
    public_apps: null,
  },
];

export const GroqModelsMap: Record<string, GroqModel> = {};
for (const v of GroqModels) {
  GroqModelsMap[v.id] = v;
}
