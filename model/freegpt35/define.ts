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

interface Message {
  id: string;
  create_time: number;
  update_time: null | number;
  content: MessageContent;
  status: string;
  end_turn: null | any;
  weight: number;
  recipient: string;
}

export interface Conversation {
  type?: 'moderation';
  is_completion?: boolean;
  message: Message;
  conversation_id: string;
  error: null | any;
}
