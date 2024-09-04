import { ComInfo } from '../../utils/pool';
import exp from 'constants';
import Joi from 'joi';

export interface Account extends ComInfo {
  api_key: string;
}

export interface PageData {
  url: string;
  page_idx: number;
  page_width: number;
  page_height: number;
  md: string;
}

export interface ProcessingData {
  pages: number | PageData[];
  progress: number;
  msg: string;
  remain: number;
}

export interface StatusData {
  uuid: string;
  status: 'processing' | 'success';
  data: ProcessingData;
}

export type SummaryReq = {
  url: string;
  limitation?: {
    maxDuration: number;
  };
  prompt?: string;
  promptConfig?: {
    showEmoji?: boolean;
    showTimestamp?: boolean;
    outlineLevel?: number;
    sentenceNumber?: number;
    detailLevel?: number;
    outputLanguage?: string;
    customPrompt?: string;
    isRefresh?: boolean;
  };
  includeDetail?: boolean;
};

export const SummaryReqJoi = {
  url: Joi.string().required(),
  limitation: Joi.object({
    maxDuration: Joi.number().required(),
  }),
  prompt: Joi.string(),
  promptConfig: Joi.object({
    showEmoji: Joi.boolean(),
    showTimestamp: Joi.boolean(),
    outlineLevel: Joi.number(),
    sentenceNumber: Joi.number(),
    detailLevel: Joi.number(),
    outputLanguage: Joi.string(),
    customPrompt: Joi.string(),
    isRefresh: Joi.boolean(),
  }),
  includeDetail: Joi.boolean(),
};

interface Subtitle {
  end: number;
  text: string;
  index: number;
  startTime: number;
}

interface VideoDetail {
  dbId: string;
  id: string;
  author: string;
  authorId: string;
  embedId: string;
  pageId: string;
  url: string;
  type: string;
  title: string;
  chapters: any[];
  cover: string;
  duration: number;
  subtitlesArray: Subtitle[];
  rawLang: string;
  descriptionText: string;
  contentText: string;
}

export type SummaryRes = {
  success: boolean;
  id: string;
  service: string;
  sourceUrl: string;
  htmlUrl?: string;
  summary: string;
  costDuration: number;
  remainingTime: number;
  detail: VideoDetail;
};

export type ChapterSummaryReq = {};
export type ChapterSummaryReqJoi = {};
export type ChapterSummaryRes = {};

export type SubtitleReq = {
  url: string;
};

export const SubtitleReqJoi = {
  url: Joi.string().required(),
};

export type SubtitleRes = {
  success: boolean;
  id: string;
  service: string;
  sourceUrl: string;
  htmlUrl?: string;
  costDuration: number;
  remainingTime: number;
  summary: string;
  detail: {
    title: string;
    descriptionText: string;
  };
};

export type ChatReq = {
  url: string;
  question: string;
  history: string[][];
  language: string;
  includeDetail: boolean;
};

export const ChatReqJoi = {
  url: Joi.string().required(),
  question: Joi.string().required(),
  history: Joi.array().items(Joi.array().items(Joi.string())).required(),
};

export type ChatRes = {
  success: boolean;
  id: string;
  service: string;
  sourceUrl: string;
  htmlUrl: string;
  costDuration: number;
  remainingTime: number;
  answer: string;
  sourceDocuments: {
    pageContent: string;
    metadata: Record<string, any>;
  }[];
};

export type ExpressReq = {
  url: string;
  articleConfig: {
    outputLanguage: string;
    showEmoji: boolean;
    isRefresh: boolean;
  };
};

export const ExpressReqJoi = {
  url: Joi.string().required(),
  articleConfig: Joi.object({
    outputLanguage: Joi.string().required(),
    showEmoji: Joi.boolean().required(),
    isRefresh: Joi.boolean().required(),
  }).required(),
};

export type ExpressRes = {
  success: boolean;
  id: string;
  service: string;
  sourceUrl: string;
  htmlUrl: string;
  costDuration: number;
  remainingTime: number;
  article: string;
};

export type VisionReq = {};
export const VisionReqJoi = {};
export type VisionRes = {};

export interface PromptRes {
  type: 'subtitle' | 'summary'; // 行为类型
  url: string; // 链接地址
  customPrompt?: string; // 自定义提示，仅当type="summary"时有效
}
