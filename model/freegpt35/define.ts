import { ComInfo } from '../../utils/pool';

export interface Account extends ComInfo {}

interface MessageContent {
  text: string;
  language: string;
  content_type: 'text';
  parts: string[];
  url?: string;
  title?: string;
}
interface Author {
  role: string;
  name: null | string;
  metadata: Record<string, any>;
}

interface Metadata {
  message_type: string;
  model_slug: string;
  parent_id: string;
  is_complete: boolean;
  timestamp_: string;
  recipient: string;
  finish_details?: {
    type?: 'max_tokens';
  };
}

interface Message {
  id: string;
  author: Author;
  create_time: number;
  update_time: null | number;
  content: MessageContent;
  status: string;
  end_turn: null | any;
  weight: number;
  metadata: Metadata;
  recipient: string;
}

export interface Conversation {
  type?: 'moderation';
  is_completion?: boolean;
  message: Message;
  conversation_id: string;
  error: null | any;
}
