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
