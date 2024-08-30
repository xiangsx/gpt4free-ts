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
  team_id: number;
  cookies: Protocol.Network.CookieParam[];
  refresh_time: number;
  usage?: UsageRes;
  destroyed?: boolean;
  proxy?: string;
  ua?: string;
  failed?: number;
}

export interface GenVideoAction {
  user_prompt: string;
  enhance_prompt: boolean;
  seed?: number;
  image_url: string;
  image_end_url?: string;
}

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

export const RunwayServerCache = new StringCache<string>(
  DefaultRedis,
  'luma_id_server',
  24 * 60 * 60,
);

export const RunwayExtendVideoCache = new StringCache<string>(
  DefaultRedis,
  'luma_extend_video',
  24 * 60 * 60,
);

export const RunwayTaskCache = new StringCache<TaskDetail>(
  DefaultRedis,
  'luma_task',
  20,
);

export enum RunwayTaskType {
  gen3a_turbo = 'gen3a_turbo',
  gen3a = 'gen3a',
}

export enum RunwayTaskStatus {
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
}

interface GenVideoOptions {
  name: string;
  seconds: number;
  text_prompt: string;
  seed: number;
  exploreMode: boolean;
  watermark: boolean;
  enhance_prompt: boolean;
  init_image: string;
  resolution: string;
  image_as_end_frame: boolean;
  assetGroupName: string;
}

export interface GenVideoTaskReq {
  taskType: RunwayTaskType;
  internal: boolean;
  options: GenVideoOptions;
  asTeamId: number;
}

export interface GenVideoTaskRes {
  task: VideoTask;
}

interface ArtifactMetadata {
  frameRate: number;
  duration: number;
  dimensions: [number, number];
  size: {
    width: number;
    height: number;
  };
}

interface Artifact {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  createdBy: number;
  taskId: string;
  parentAssetGroupId: string;
  filename: string;
  url: string;
  fileSize: string;
  isDirectory: boolean;
  previewUrls: string[];
  private: boolean;
  privateInTeam: boolean;
  deleted: boolean;
  reported: boolean;
  metadata: ArtifactMetadata;
  favorite: boolean;
}

interface VideoTask {
  id: string;
  name: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  taskType: RunwayTaskType;
  options: GenVideoOptions;
  status: RunwayTaskStatus;
  error: string | null;
  progressText: string | null;
  progressRatio: string;
  estimatedTimeToStartSeconds: number | null;
  artifacts: Artifact[];
  sharedAsset: string | null;
}

export interface GetVideoTaskRes {
  task: VideoTask;
}

export interface UploadsReq {
  filename: string;
  numberOfParts: number;
  type: 'DATASET';
}

export interface UploadsRes {
  id: string;
  uploadUrls: string[];
  uploadHeaders: {
    'Content-Type': string;
  };
}
