import { ComInfo } from '../../utils/pool';

export interface Account extends ComInfo {
  token: string;
  server_id: string;
  channel_id: string;
}

export enum GatewayEvents {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatACK = 11,
}

export enum GatewayMessageType {
  DEFAULT = 0,
  RECIPIENT_ADD = 1,
  RECIPIENT_REMOVE = 2,
  CALL = 3,
  CHANNEL_NAME_CHANGE = 4,
  CHANNEL_ICON_CHANGE = 5,
  CHANNEL_PINNED_MESSAGE = 6,
  USER_JOIN = 7,
  GUILD_BOOST = 8,
  GUILD_BOOST_TIER_1 = 9,
  GUILD_BOOST_TIER_2 = 10,
  GUILD_BOOST_TIER_3 = 11,
  CHANNEL_FOLLOW_ADD = 12,
  GUILD_DISCOVERY_DISQUALIFIED = 14,
  GUILD_DISCOVERY_REQUALIFIED = 15,
  GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING = 16,
  GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING = 17,
  THREAD_CREATED = 18,
  REPLY = 19,
  CHAT_INPUT_COMMAND = 20,
  THREAD_STARTER_MESSAGE = 21,
  GUILD_INVITE_REMINDER = 22,
  CONTEXT_MENU_COMMAND = 23,
  AUTO_MODERATION_ACTION = 24,
  ROLE_SUBSCRIPTION_PURCHASE = 25,
  INTERACTION_PREMIUM_UPSELL = 26,
  STAGE_START = 27,
  STAGE_END = 28,
  STAGE_SPEAKER = 29,
  STAGE_TOPIC = 31,
  GUILD_APPLICATION_PREMIUM_SUBSCRIPTION = 32,
}

export enum GatewayEventName {
  INTERACTION_CREATE = 'INTERACTION_CREATE',
  INTERACTION_SUCCESS = 'INTERACTION_SUCCESS',
  MESSAGE_CREATE = 'MESSAGE_CREATE',
  MESSAGE_UPDATE = 'MESSAGE_UPDATE',
}

interface Embed {
  type: string;
  title: string;
  footer: {
    text: string;
  };
  description: string;
  content_scan_version: number;
  color: number;
}

export interface MessageSubComponent {
  type?: number;
  style?: number;
  label?: string;
  name?: string;
  custom_id: string;
  component_type?: number;
  emoji?: { name: string };
  values?: string[];
}

export interface MessageComponent {
  type: number;
  components: MessageSubComponent[];
}

export interface UserMember {
  roles: string[];
  premium_since: any;
  pending: boolean;
  nick: any;
  mute: boolean;
  joined_at: string;
  flags: number;
  deaf: boolean;
  communication_disabled_until: any;
  avatar: any;
}

export interface User {
  username: string;
  public_flags: number;
  id: string;
  global_name: string | null;
  discriminator: string;
  avatar_decoration_data: any | null;
  avatar: string | null;
  premium_type?: number;
  bot?: boolean;
  member?: UserMember;
}

export interface GatewayEventPayload<T = any> {
  op: GatewayEvents;
  d: T;
  s?: number;
  t?: GatewayEventName;
}

export type GatewayHandler<T = any> = (payload: GatewayEventPayload<T>) => void;

export interface GatewayDHello {
  heartbeat_interval: number;
  _trace: string[];
}

export interface GatewayDInteractionCreate {
  nonce?: string;
  id: string;
}

export interface GatewayDInteractionSuccess {
  nonce?: string;
  id: string;
}

export interface GatewayMessageAttachment {
  width: number;
  url: string;
  size: number;
  proxy_url: string;
  placeholder_version: number;
  placeholder: string;
  id: string;
  height: number;
  filename: string;
  content_type: string;
}

export interface GatewayMessage {
  webhook_id: string;
  type: GatewayMessageType;
  tts: boolean;
  timestamp: string;
  pinned: boolean;
  nonce: string;
  mentions: any[];
  mention_roles: any[];
  mention_everyone: boolean;
  message_reference: {
    message_id: string;
    guild_id: string;
    channel_id: string;
  };
  interaction?: ApplicationCommand;
  id: string;
  flags: number;
  embeds: Embed[];
  edited_timestamp: string | null;
  content: string;
  components: MessageComponent[];
  channel_id: string;
  author: User;
  attachments: GatewayMessageAttachment[];
  application_id: string;
  member: UserMember;
  guild_id: string;
}

export interface GatewayDMessageCreate extends GatewayMessage {}

export interface GatewayDMessageUpdate extends GatewayMessage {}

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

export interface InteractionPayload<T extends InteractionType> {
  type: InteractionType;
  application_id: string;
  guild_id: string;
  channel_id: string;
  session_id: string;
  data: T extends InteractionType.APPLICATION_COMMAND
    ? ApplicationCommand
    : T extends InteractionType.MESSAGE_COMPONENT
    ? MessageSubComponent
    : never;
  nonce: string;
  message_flags?: number;
  message_id?: string;
  analytics_location?: string;
}

export interface InteractionDataOption {
  type: number;
  name: string;
  value?: string;
}

export enum ApplicationCommandType {
  CHAT_INPUT = 1, // Slash commands; a text-based command that shows up when a user types /
  USER = 2, // A UI-based command that shows up when you right click or tap on a user
  MESSAGE = 3, // A UI-based command that shows up when you right click or tap on a message
}

export interface ApplicationCommand {
  version: string;
  id: string;
  name: string;
  type: ApplicationCommandType;
  options: ApplicationCommandOption[];
  application_id?: string;
  description?: string;
  integration_types?: number[];
  global_popularity_rank?: number;
  description_localized?: string;
  name_localized?: string;
  application_command?: ApplicationCommand;
  user?: User;
  attachments?: any[];
}

export interface ApplicationCommandOption {
  type: number;
  name: string;
  value?: string;
  description?: string;
  required?: boolean;
  description_localized?: string;
  name_localized?: string;
}

export const MJApplicationID = '936929561302675456';

export const ImagineCommand: ApplicationCommand = {
  id: '938956540159881230',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: '936929561302675456',
  version: '1166847114203123795',
  name: 'imagine',
  description: 'Create images with Midjourney',
  options: [
    {
      type: 3,
      name: 'prompt',
      description: 'The prompt to imagine',
      required: true,
      description_localized: 'The prompt to imagine',
      name_localized: 'prompt',
    },
  ],
  integration_types: [0],
  global_popularity_rank: 1,
  description_localized: 'Create images with Midjourney',
  name_localized: 'imagine',
};

export function getProgress(text: string) {
  // 这个正则表达式匹配后面跟着百分号的数字
  const regex = /\d+(\.\d+)?(?=%)/;
  // 'match'将返回文本中的第一个匹配项
  const match = text.match(regex);
  // 将匹配的字符串转换为数字
  return match ? Number(match[0]) : null;
}

export enum AIActionType {
  Imagine = 'imagine',
  Blend = 'blend',
  Component = 'component',
}

export type AIAction = {
  type: AIActionType;
  prompt?: string;
  message_id?: string;
  custom_id?: string;
  image_urls?: string[];
  component_type?: number;
};

export const ComponentLabelMap: Record<string, string> = {
  U1: '放大第一张',
  U2: '放大第二张',
  U3: '放大第三张',
  U4: '放大第四张',
  '🔄': '重新生成',
  V1: '第一张变体',
  V2: '第二张变体',
  V3: '第三张变体',
  V4: '第四张变体',
  'Upscale (Subtle)': '细微放大',
  'Upscale (Creative)': '创造放大',
  'Vary (Subtle)': '细微变体',
  'Vary (Strong)': '强烈变体',
};
