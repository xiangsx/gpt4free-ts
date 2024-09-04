import { ComInfo } from '../../utils/pool';
import { Protocol } from 'puppeteer';
import { DefaultRedis, StringCache } from '../../utils/cache';

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

export type ErrorRes = { detail: string };

export const ViduServerCache = new StringCache<string>(
  DefaultRedis,
  'vidu_id_server',
  24 * 60 * 60,
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

export enum EViduModel {
  stable = 'stable',
  vidu1 = 'vidu-1',
}

export enum EViduStyle {
  general = 'general',
  anime = 'anime',
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
  style: EViduStyle;
  aspect_ratio: string;
  duration: number;
  model: EViduModel;
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
  state: ETaskState;
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

export interface Action {
  prompt: 'string'; // 视频的详细描述，必须是英文的
  enhance: boolean; // 是否扩展提示词
  aspect_ratio?: '16:9'; // 视频的宽高比 目前固定为16：9 不可更改
  duration?: 4; // 目前固定为 4，不允许修改
  image_url?: 'string'; // [可选] 图片的url地址，如果用户请求里面无图片链接，则不需要此参数
  image_character?: boolean; // [可选] 默认不填即为false， 如果 true: 图片作为视频的角色出现，false: 图片作为首帧出现
}
