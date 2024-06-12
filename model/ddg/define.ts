import { ModelType } from '../base';

export const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.Mixtral8x7bInstruct]: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  [ModelType.LLama_3_70b_chat]: 'meta-llama/Llama-3-70b-chat-hf',
};
