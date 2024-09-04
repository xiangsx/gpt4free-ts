import { ComInfo } from '../../utils/pool';
import { ChatRequest } from '../base';

export interface Account extends ComInfo {
  apikey: string;
  banned?: boolean;
  low_credit?: boolean;
  refresh_unix?: number;
}

export interface MessagesReq extends ChatRequest {
  functions?: {
    name: string;
    description?: string;
    parameters: object;
  };
  stream?: boolean;
  system?: string;
  max_tokens?: number;
}

export const MessagesParamsList = ['model', 'messages', 'stream', 'max_tokens'];

export const ParamsList = [
  'model',
  'messages',
  'functions',
  'function_call',
  'temperature',
  'top_p',
  'n',
  'stream',
  'stop',
  'max_tokens',
  'presence_penalty',
  'frequency_penalty',
  'logit_bias',
  'user',
  'gizmo_id',
  'response_format',
];

export type OpenaiError = {
  error: {
    message: string;
  };
};
