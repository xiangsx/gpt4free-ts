import { ChatRequest, ModelType } from '../base';

export interface GeminiRequest extends ChatRequest {
  temperature?: number;
  topP?: number;
  topK?: number;
}

export const MaxOutputTokens: Partial<Record<ModelType, number>> = {
  [ModelType.Gemini1p5Flash]: 8192,
  [ModelType.Gemini1p5Pro]: 8192,
  [ModelType.GeminiPro]: 4096,
  [ModelType.GeminiProVision]: 2000,
};
