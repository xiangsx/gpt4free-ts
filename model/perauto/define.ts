import { ComInfo } from '../../utils/pool';
import { ChatRequest, ModelType } from '../base';

type UseLeft = Partial<Record<ModelType, number>>;

export interface Account extends ComInfo {
  email: string;
  password: string;
  recovery: string;
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
