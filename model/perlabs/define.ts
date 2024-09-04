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

export const PerLabsModelExistedMap: Partial<Record<ModelType, boolean>> = {
  [ModelType.Llama3SonarLarge32kChat]: true,
  [ModelType.Llama3SonarLarge32kOnline]: true,
  [ModelType.Llama3SonarSmall32kOnline]: true,
  [ModelType.Llama3SonarSmall32kChat]: true,
  [ModelType.DbrxInstruct]: true,
  [ModelType.Claude3Haiku20240307]: true,
  [ModelType.Codellama70bInstruct]: true,
  [ModelType.Mistral7bInstruct]: true,
  [ModelType.LlavaV15_7b]: true,
  [ModelType.LlavaV16_34b]: true,
  [ModelType.Mixtral8x7bInstruct]: true,
  [ModelType.Mixtral8x22bInstruct]: true,
  [ModelType.Mixtral8x22b]: true,
  [ModelType.MistralMedium]: true,
  [ModelType.Gemma2bIt]: true,
  [ModelType.Gemma7bIt]: true,
  [ModelType.Llama3_8bInstruct]: true,
  [ModelType.Llama3_70bInstruct]: true,
};

export enum PerLabEvents {
  PerplexityLabs = 'perplexity_labs',
  QueryProgress = 'query_progress',
}
