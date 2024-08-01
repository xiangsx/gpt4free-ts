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
  user_id: string;
  cookies: Protocol.Network.CookieParam[];
  refresh_time: number;
  credits?: CreditsRes;
  destroyed?: boolean;
  proxy?: string;
  ua?: string;
}

export interface GenVideoReq {
  user_prompt: string;
  aspect_ratio: '16:9';
  expand_prompt: boolean;
  loop?: boolean;
  image_url?: string;
  image_end_url?: string;
}

export type GenVideoRes = TaskDetail[];

export type ErrorRes = { detail: string };

export interface TaskDetail {
  id: string;
  prompt: string;
  state: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  video: VideoDetails | null;
  liked: boolean | null;
  estimate_wait_seconds: number | null;
}

interface VideoDetails {
  url: string;
  width: number;
  height: number;
  thumbnail: string | null;
}

interface Subscription {
  active: boolean;
  plan: string;
  type: string | null;
}

interface Plan {
  name: string;
  key: string;
  capacity_per_month: number;
  monthly_cost_in_cents: number;
  yearly_cost_in_cents: number;
}

export interface UsageRes {
  consumed: number;
  capacity: number;
  available: number;
  subscription: Subscription;
  plans: Plan[];
}

export interface GetUploadURLRes {
  id: string;
  presigned_url: string;
  public_url: string;
}

export const ViduServerCache = new StringCache<string>(
  DefaultRedis,
  'vidu_id_server',
  24 * 60 * 60,
);

export const ViduTaskCache = new StringCache<TaskDetail>(
  DefaultRedis,
  'vidu_task',
  20,
);

export enum ETaskState {
  queueing = 'queueing',
  processing = 'processing',
  success = 'success',
}

export enum ETaskType {
  upscale = 'upscale',
  text2video = 'text2video',
  img2video = 'img2video',
  character2video = 'character2video',
}

interface TextPrompt {
  type: 'text' | 'image';
  content: string;
  negative?: boolean;
  enhance: boolean;
  recaption?: string;
}

interface Input {
  creation_id?: string;
  prompts: TextPrompt[];
  lang?: string;
}

interface Settings {
  style: string;
  aspect_ratio: string;
  duration: number;
  model: string;
}

export interface TaskReq {
  input: Input;
  type: ETaskType;
  settings: Settings;
}

interface VideoResolution {
  width: number;
  height: number;
}

interface VideoDetails {
  duration: number;
  fps: number;
  resolution: VideoResolution;
}

interface Creation {
  id: string;
  task_id: string;
  type: string;
  grade: string;
  uri: string;
  cover_uri: string;
  resolution: VideoResolution;
  vote: string;
  is_favor: boolean;
  src_video_duration: number;
  creator_id: string;
  video: VideoDetails;
  is_deleted: boolean;
  err_code: string;
  created_at: string;
}

export interface Task {
  id: string;
  input: Input;
  settings: Settings;
  type: string;
  state: string;
  creations: Creation[];
  err_code: string;
  created_at: string;
}

export interface TaskRes extends Task {}

export interface TaskStateProcess {
  state: ETaskState;
  estimated_time_left: number;
  err_code: string;
}

export interface CreditsRes {
  credits: number;
  credits_expire_today: number;
  credits_expire_monthly: number;
  credits_permanent: number;
}
