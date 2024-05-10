import { ComInfo } from '../../utils/pool';
import { Protocol } from 'puppeteer';
import exp from 'constants';
import { ModelType } from '../base';

export interface Account extends ComInfo {
  token: string;
  sid?: string;
  ua?: string;
  credit_left?: number;
  // 刷新时间
  refresh_time?: number;
  need_pay?: boolean;
}

export interface BillInfo {
  is_active: boolean;
  is_past_due: boolean;
  credits: number;
  subscription_type: boolean;
  renews_on: null | string;
  cancel_on: null | string;
  period: null | string;
  changing_to: null | string;
  monthly_usage: number;
  monthly_limit: number;
  credit_packs: CreditPack[];
  plan: null | PlanDetail;
  plans: Plan[];
  total_credits_left: number;
}

interface PlanDetail {
  // This could have more or specific details relevant to the current plan
}

interface CreditPack {
  id: string;
  amount: number;
  price_usd: number;
}

interface Plan {
  id: string;
  level: number;
  name: string;
  features: string;
  monthly_price_usd: number;
}

interface User {
  email: string;
  username: string;
  id: string;
  display_name: string | null;
  handle: string;
  profile_description: string | null;
  is_handle_editable: boolean;
}

interface Model {
  id: string;
  name: string;
  external_key: string;
  major_version: number;
}

interface Roles {
  sub: boolean;
  has_accepted_custom_mode_tos: boolean;
}

interface Flags {
  continue_anywhere: boolean;
  playlists: boolean;
  v3_alpha: boolean;
  new_upgrade_method: boolean;
}

export interface SessionInfo {
  user: User;
  models: Model[];
  roles: Roles;
  flags: Flags;
}

export const SongStyle = [
  'acoustic',
  'aggressive',
  'anthemic',
  'atmospheric',
  'bouncy',
  'chill',
  'dark',
  'dreamy',
  'electronic',
  'emotional',
  'epic',
  'experimental',
  'futuristic',
  'groovy',
  'heartfelt',
  'infectious',
  'melodic',
  'mellow',
  'powerful',
  'psychedelic',
  'romantic',
  'smooth',
  'syncopated',
  'uplifting',
  '',
];
export const SongGenres = [
  'afrobeat',
  'anime',
  'ballad',
  'bedroom pop',
  'bluegrass',
  'blues',
  'classical',
  'country',
  'cumbia',
  'dance',
  'dancepop',
  'delta blues',
  'electropop',
  'disco',
  'dream pop',
  'drum and bass',
  'edm',
  'emo',
  'folk',
  'funk',
  'future bass',
  'gospel',
  'grunge',
  'grime',
  'hip hop',
  'house',
  'indie',
  'j-pop',
  'jazz',
  'k-pop',
  'kids music',
  'metal',
  'new jack swing',
  'new wave',
  'opera',
  'pop',
  'punk',
  'raga',
  'rap',
  'reggae',
  'reggaeton',
  'rock',
  'rumba',
  'salsa',
  'samba',
  'sertanejo',
  'soul',
  'synthpop',
  'swing',
  'synthwave',
  'techno',
  'trap',
  'uk garage',
];
export const SongThemes = [
  'a bad breakup',
  'finding love on a rainy day',
  'a cozy rainy day',
  'dancing all night long',
  'dancing with you for the last time',
  'not being able to wait to see you again',
  "how you're always there for me",
  "when you're not around",
  'a faded photo on the mantel',
  'a literal banana',
  'wanting to be with you',
  'writing a face-melting guitar solo',
  'the place where we used to go',
  'being trapped in an AI song factory, help!',
];

export interface SongOptions {
  prompt: string;
  tags: string;
  mv: ModelType;
  title: string;
  make_instrumental?: boolean;
  gpt_description_prompt?: string;
  continue_clip_id: null | string;
  continue_at: null | string;
}

export interface CreateSongRes {
  id: string;
  clips: Clip[];
  metadata: Metadata;
  major_model_version: string;
  status: string;
  created_at: string;
  batch_size: number;
}

export interface Clip {
  id: string;
  video_url: string;
  audio_url: string;
  image_url: null;
  image_large_url: null;
  major_model_version: string;
  model_name: string;
  metadata: Metadata;
  is_liked: boolean;
  user_id: string;
  is_trashed: boolean;
  reaction: null;
  created_at: string;
  status: 'queued' | 'streaming' | 'complete' | 'error';
  title: string;
  play_count: number;
  upvote_count: number;
  is_public: boolean;
}

interface Metadata {
  tags: string;
  prompt: string;
  gpt_description_prompt: null;
  audio_prompt_id: null;
  history: null;
  concat_history: null;
  type: string;
  duration: null;
  refund_credits: null;
  stream: boolean;
  error_type: null;
  error_message: null;
}
