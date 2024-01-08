import { ChatRequest } from '../base';

export interface GeminiRequest extends ChatRequest {
  temperature?: number;
  topP?: number;
  topK?: number;
}
