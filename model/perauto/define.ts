import { ComInfo } from '../../utils/pool';
import { ChatRequest, ModelType } from '../base';

type UseLeft = Partial<Record<ModelType, number>>;

export interface Account extends ComInfo {
  email: string;
  password: string;
  recovery: string;
  proxy?: string;
  visitor_id: string;
  login_time?: string;
  last_use_time?: string;
  token: string;
  failedCnt: number;
  invalid?: boolean;
  use_left?: UseLeft;
  model?: string;
}

export enum FocusType {
  All = 1,
  Academic = 2,
  Writing = 3,
  Wolfram = 4,
  YouTube = 5,
  Reddit = 6,
}

export const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT3p5Turbo]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(1)',
  [ModelType.Sonar]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(2)',
  [ModelType.GPT4TurboPreview]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(3)',
  [ModelType.GPT4]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(3)',
  [ModelType.Claude3Sonnet20240229]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(4)',
  [ModelType.Claude3Opus20240229]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(5)',
  [ModelType.MistralLarge]:
    'div.flex.justify-center.items-center > div > div > div > div > div > div:nth-child(6)',
};

export interface PerplexityChatRequest extends ChatRequest {
  retry?: number;
}

export enum PerEvents {
  SaveUserSettings = 'saveUserSettings',
  AnalyticsEvent = 'analytics_event',
  PerplexityAsk = 'perplexity_ask',
  QueryProgress = 'query_progress',
}

export interface PerEventReq {
  version: '2.5';
  source: 'default';
}

export const DefaultPerEventReq: PerEventReq = {
  version: '2.5',
  source: 'default',
};

export interface UserSettings extends PerEventReq {
  default_copilot: boolean;
}

// {
//     "version": "2.5",
//     "source": "default",
//     "attachments": [],
//     "language": "en-US",
//     "timezone": "Asia/Shanghai",
//     "search_focus": "internet",
//     "frontend_uuid": "affe3e59-a502-4a1d-b39b-780c608ec739",
//     "mode": "copilot",
//     "is_related_query": false,
//     "is_default_related_query": false,
//     "visitor_id": "eac7753f-69a6-4843-bd5f-3a2fa3eac49e",
//     "frontend_context_uuid": "a9c38fae-6bc9-40b7-8d1d-919f932225b4",
//     "prompt_source": "user",
//     "query_source": "home"
// }

export enum PerAskSearchFocus {
  Internet = 'internet',
  Academic = 'academic',
  Writing = 'writing',
  Wolfram = 'wolfram',
  YouTube = 'youtube',
  Reddit = 'reddit',
}

export enum PerAskMode {
  Copilot = 'copilot',
  Concise = 'concise',
}
export interface PerAsk extends PerEventReq {
  attachments: any[];
  language: string;
  timezone: string;
  search_focus: PerAskSearchFocus;
  frontend_uuid: string;
  mode: PerAskMode;
  is_related_query: boolean;
  is_default_related_query: boolean;
  visitor_id: string;
  frontend_context_uuid: string;
  prompt_source: string;
  query_source: string;
}

export interface PerMessageResponse {
  status: string;
  uuid: string;
  read_write_token: string;
  frontend_context_uuid: string;
  text: string;
  final: boolean;
  backend_uuid: string;
  media_items: any[];
  widget_data: any[];
  knowledge_cards: any[];
  expect_search_results: boolean;
  mode: string;
  search_focus: string;
  gpt4: boolean;
  display_model: string;
  attachments: any[];
  query_str: string;
  related_queries: any[];
  step_type: string;
  personalized: boolean;
  context_uuid: string;
  thread_title: string;
  thread_access: number;
  thread_url_slug: string;
  author_username: string;
  author_image: string;
  s3_social_preview_url: string;
  updated_datetime: string;
  author_id: string;
  prompt_source: string;
  query_source: string;
}
