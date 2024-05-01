import { ComInfo } from '../../utils/pool';

export interface Account extends ComInfo {
  base_url: string;
  api_key: string;
}

export interface ComReturn<T = DiscordProperties> {
  code: number;
  description: string;
  properties: T;
  result: string;
}

export interface DiscordProperties {
  discordChannelId: string;
  discordInstanceId: string;
}

export interface Task {
  id: string;
  action: string;
  prompt: string;
  promptEn: string;
  description: string;
  state: string;
  submitTime: number;
  startTime: number;
  finishTime: number;
  imageUrl: string;
  status: string;
  progress: string;
  failReason: string;
  properties: TaskProperties;
  buttons: TaskButton[];
}

interface TaskProperties {
  botType: BotType;
  discordChannelId: string;
  discordInstanceId: string;
  finalPrompt: string;
  flags: number;
  messageContent: string;
  messageHash: string;
  messageId: string;
  nonce: string;
  progressMessageId: string;
}

interface TaskButton {
  customId: string;
  emoji: string;
  label: string;
  style: number;
  type: number;
}

interface AccountFilter {
  channelId: string;
  instanceId: string;
  modes: any[];
  remark: string;
  remix: boolean;
  remixAutoConsidered: boolean;
}

export enum BotType {
  MID_JOURNEY = 'MID_JOURNEY',
  NIJI_JOURNEY = 'NIJI_JOURNEY',
}

export interface ImagineRequest {
  botType: BotType;
  prompt: string;
  base64Array?: string[];
  accountFilter?: AccountFilter;
  notifyHook?: string;
  state?: string;
}

export interface BlendRequest {
  botType: BotType;
  base64Array: string[];
  dimensions: string;
  accountFilter?: AccountFilter;
  notifyHook?: string;
  state?: string;
}

export interface ActionRequest {
  customId: string;
  taskId: string;
  accountFilter?: AccountFilter;
  notifyHook?: string;
  state?: string;
}

export interface SwapFaceRequest {
  sourceBase64: string;
  targetBase64: string;
  accountFilter: AccountFilter;
  notifyHook: string;
  state: string;
}

export enum ToolType {
  Imagine = 'imagine',
  Blend = 'blend',
  Action = 'action',
  SwapFace = 'swap-face',
}

export interface ToolInfo {
  type: ToolType;
  prompt?: string;
  task_id?: string;
  custom_id?: string;
  dimensions?: 'PORTRAIT' | 'SQUARE' | 'LANDSCAPE';
  image_urls?: string[];
  source_image?: string;
  target_image?: string;
}

export interface ImageTool extends ToolInfo {
  prompt: string;
}

export interface BlendTool extends ToolInfo {
  dimensions: 'PORTRAIT' | 'SQUARE' | 'LANDSCAPE';
  image_urls: string[];
}

export interface ActionTool extends ToolInfo {
  task_id: string;
  custom_id: string;
}

export interface SwapFaceTool extends ToolInfo {
  source_image: string;
  target_image: string;
}
