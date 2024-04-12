import { ComInfo } from '../../utils/pool';
import { Message, ModelType } from '../base';

export interface Account extends ComInfo {
  proxy?: string;
}

export interface MessageReq {
  version: string;
  source: 'default';
  model: ModelType;
  messages: (Message & { priority: number })[];
  timezone: 'Asia/Shanghai';
}

export interface MessageRes {
  elapsed_time: number;
  final: boolean;
  output: string;
  tokens_streamed: number;
  status?: 'completed';
}

// 例如SonalSmallOnline = 'sonar-small-online',
export enum PerLabsModelEnum {
  SonalSmallOnline = 'sonar-small-online',
  SonalMediumOnline = 'sonar-medium-online',
  SonalSmallChat = 'sonar-small-chat',
  SonalMediumChat = 'sonar-medium-chat',
  DbrxInstruct = 'dbrx-instruct',
  Claude3Haiku = 'claude-3-haiku-20240307',
  Codellama70bInstruct = 'codellama-70b-instruct',
  Mistral7bInstruct = 'mistral-7b-instruct',
  LlavaV15_7b = 'llava-v1.5-7b-wrapper',
  LlavaV16_34b = 'llava-v1.6-34b',
  Mixtral8x7bInstruct = 'mixtral-8x7b-instruct',
  Mixtral8x22b = 'mixtral-8x22b',
  MistralMedium = 'mistral-medium',
  Gemma2bIt = 'gemma-2b-it',
  Gemma7bIt = 'gemma-7b-it',
  Related = 'related',
}

export const PerLabsModelExistedMap: Partial<Record<ModelType, boolean>> = {
  [PerLabsModelEnum.SonalSmallOnline]: true,
  [PerLabsModelEnum.SonalMediumOnline]: true,
  [PerLabsModelEnum.SonalSmallChat]: true,
  [PerLabsModelEnum.SonalMediumChat]: true,
  [PerLabsModelEnum.DbrxInstruct]: true,
  [PerLabsModelEnum.Claude3Haiku]: true,
  [PerLabsModelEnum.Codellama70bInstruct]: true,
  [PerLabsModelEnum.Mistral7bInstruct]: true,
  [PerLabsModelEnum.LlavaV15_7b]: true,
  [PerLabsModelEnum.LlavaV16_34b]: true,
  [PerLabsModelEnum.Mixtral8x7bInstruct]: true,
  [PerLabsModelEnum.Mixtral8x22b]: true,
  [PerLabsModelEnum.MistralMedium]: true,
  [PerLabsModelEnum.Gemma2bIt]: true,
  [PerLabsModelEnum.Gemma7bIt]: true,
};

export enum PerLabEvents {
  PerplexityLabs = 'perplexity_labs',
  QueryProgress = 'query_progress',
}
