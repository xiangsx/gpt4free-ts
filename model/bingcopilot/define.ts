import { ComInfo } from '../../utils/pool';

export interface Account extends ComInfo {}

export interface MessageUpdate {
  text: string;
  author: string;
  createdAt: string;
  timestamp: string;
  messageId: string;
  requestId: string;
  offense: string;
  adaptiveCards: AdaptiveCard[];
  sourceAttributions: any[];
  feedback: {
    tag: null | string;
    updatedOn: null | string;
    type: string;
  };
  contentOrigin: string;
  suggestedResponses: SuggestedResponse[];
}

interface AdaptiveCard {
  type: string;
  version: string;
  body: TextBlock[];
}

interface TextBlock {
  type: string;
  text: string;
  wrap: boolean;
}

interface SuggestedResponse {
  text: string;
  author: string;
  createdAt: string;
  timestamp: string;
  messageId: string;
  messageType: string;
  offense: string;
  feedback: {
    tag: null | string;
    updatedOn: null | string;
    type: string;
  };
  contentOrigin: string;
}

export interface Message {
  type: 1 | 2 | 6;
  target: string;
  arguments: [
    {
      messages: MessageUpdate[];
    },
  ];
}
