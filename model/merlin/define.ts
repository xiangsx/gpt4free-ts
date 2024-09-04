import { ComInfo } from '../../utils/pool';
import { ModelType } from '../base';

export interface Account extends ComInfo {
  username: string;
  email: string;
  recovery?: string;
  password: string;
  left: number;
  login_failed?: number;
  useOutTime: number;
  accessToken: string;
  tokenGotTime: number;
}
export const ModelMap: Partial<Record<ModelType, string>> = {
  [ModelType.GPT4]: 'GPT 4',
  [ModelType.GPT3p5Turbo]: 'GPT 3',
  [ModelType.Claude3Opus20240229]: 'claude-3-opus',
  [ModelType.Claude3Opus]: 'claude-3-opus',
  [ModelType.Claude3Haiku]: 'claude-3-haiku',
  [ModelType.Claude3Haiku20240307]: 'claude-3-haiku',
  [ModelType.Claude3Haiku200k]: 'claude-3-haiku',
};
