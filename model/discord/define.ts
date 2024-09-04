import { ComInfo } from '../../utils/pool';
import exp from 'constants';

export interface DiscordAccount extends ComInfo {
  token: string;
  server_id: string;
  channel_id: string;
  auth_failed?: boolean;
}

export enum MessageFlags {
  CROSSPOSTED = 1 << 0, // this message has been published to subscribed channels (via Channel Following)
  IS_CROSSPOST = 1 << 1, // this message originated from a message in another channel (via Channel Following)
  SUPPRESS_EMBEDS = 1 << 2, // do not include any embeds when serializing this message
  SOURCE_MESSAGE_DELETED = 1 << 3, // the source message for this crosspost has been deleted (via Channel Following)
  URGENT = 1 << 4, // this message came from the urgent message system
  HAS_THREAD = 1 << 5, // this message has an associated thread, with the same id as the message
  EPHEMERAL = 1 << 6, // this message is only visible to the user who invoked the Interaction
  LOADING = 1 << 7, // this message is an Interaction Response and the bot is "thinking"
  FAILED_TO_MENTION_SOME_ROLES_IN_THREAD = 1 << 8, // this message failed to mention some roles and add their members to the thread
  SUPPRESS_NOTIFICATIONS = 1 << 12, // this message will not trigger push and desktop notifications
  IS_VOICE_MESSAGE = 1 << 13, // this message is a voice message
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
  placeholder?: string;
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
  flags: MessageFlags;
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

export enum ApplicationCommandOptionType {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  INTEGER = 4, // Any integer between -2^53 and 2^53
  BOOLEAN = 5,
  USER = 6,
  CHANNEL = 7, // Includes all channel types + categories
  ROLE = 8,
  MENTIONABLE = 9, // Includes users and roles
  NUMBER = 10, // Any double between -2^53 and 2^53
  ATTACHMENT = 11, // attachment object
}

export interface ApplicationCommand {
  version: string;
  id: string;
  name: string;
  type: ApplicationCommandType;
  options: ApplicationCommandOption[];
  application_id?: string;
  description?: string;
  dm_permission?: boolean;
  integration_types?: number[];
  global_popularity_rank?: number;
  description_localized?: string;
  name_localized?: string;
  application_command?: ApplicationCommand;
  user?: User;
  attachments?: ApplicationCommandAttachment[];
}

export interface ApplicationCommandAttachment {
  id: string;
  filename: string;
  uploaded_filename: string;
}

export interface ChoiceItem {
  name: string;
  value: string | number;
  name_localized: string;
}

export interface ApplicationCommandOption {
  type: ApplicationCommandOptionType;
  name: string;
  value?: string | number;
  description?: string;
  required?: boolean;
  autocomplete?: boolean;
  description_localized?: string;
  name_localized?: string;
  choices?: ChoiceItem[];
}

export const MJApplicationID = '936929561302675456';

export const ImagineCommand: ApplicationCommand = {
  id: '938956540159881230',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: MJApplicationID,
  version: '1166847114203123795',
  name: 'imagine',
  description: 'Create images with Midjourney',
  options: [
    {
      type: ApplicationCommandOptionType.STRING,
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

export const InfoCommand: ApplicationCommand = {
  id: '972289487818334209',
  type: 1,
  application_id: '936929561302675456',
  version: '1166847114203123799',
  name: 'info',
  description: 'View information about your profile.',
  integration_types: [0],
  global_popularity_rank: 3,
  options: [],
  description_localized: 'View information about your profile.',
  name_localized: 'info',
};

export const BlendCommand: ApplicationCommand = {
  id: '1062880104792997970',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: MJApplicationID,
  version: '1166847114203123796',
  name: 'blend',
  description: 'Blend images together seamlessly!',
  options: [
    {
      type: ApplicationCommandOptionType.ATTACHMENT,
      name: 'image1',
      description: 'First image to add to the blend',
      required: true,
      description_localized: 'First image to add to the blend',
      name_localized: 'image1',
    },
    {
      type: ApplicationCommandOptionType.ATTACHMENT,
      name: 'image2',
      description: 'Second image to add to the blend',
      required: true,
      description_localized: 'Second image to add to the blend',
      name_localized: 'image2',
    },
    {
      type: ApplicationCommandOptionType.STRING,
      name: 'dimensions',
      description:
        'The dimensions of the image. If not specified, the image will be square.',
      required: false,
      choices: [
        { name: 'Portrait', value: '--ar 2:3', name_localized: 'Portrait' },
        {
          name: 'Square',
          value: '--ar 1:1',
          name_localized: 'Square',
        },
        {
          name: 'Landscape',
          value: '--ar 3:2',
          name_localized: 'Landscape',
        },
      ],
      description_localized:
        'The dimensions of the image. If not specified, the image will be square.',
      name_localized: 'dimensions',
    },
    {
      type: ApplicationCommandOptionType.ATTACHMENT,
      name: 'image3',
      description: 'Third image to add to the blend (optional)',
      required: false,
      description_localized: 'Third image to add to the blend (optional)',
      name_localized: 'image3',
    },
    {
      type: ApplicationCommandOptionType.ATTACHMENT,
      name: 'image4',
      description: 'Fourth image to add to the blend (optional)',
      required: false,
      description_localized: 'Fourth image to add to the blend (optional)',
      name_localized: 'image4',
    },
    {
      type: ApplicationCommandOptionType.ATTACHMENT,
      name: 'image5',
      description: 'Fifth image to add to the blend (optional)',
      required: false,
      description_localized: 'Fifth image to add to the blend (optional)',
      name_localized: 'image5',
    },
  ],
  integration_types: [0],
  global_popularity_rank: 3,
  description_localized: 'Blend images together seamlessly!',
  name_localized: 'blend',
};

export function getProgress(text: string) {
  // 这个正则表达式匹配后面跟着百分号的数字
  const regex = /\d+(\.\d+)?(?=%)/;
  // 'match'将返回文本中的第一个匹配项
  const match = text.match(regex);
  // 将匹配的字符串转换为数字
  return match ? Number(match[0]) : null;
}

export function getPrompt(text: string) {
  const regex = /\*\*(.*?)\*\*/;
  let match = regex.exec(text);

  return match ? match[1] : null;
}

export enum AIActionType {
  Imagine = 'imagine',
  Blend = 'blend',
  Component = 'component',
}

export type AIAction = {
  type: AIActionType;
  prompt?: string;
  channel_id?: string;
  message_id?: string;
  custom_id?: string;
  image_urls?: string[];
  component_type?: number;
  dimensions?: string;
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
  'Zoom Out 2x': '缩放2倍',
  'Zoom Out 1.5x': '缩放1.5倍',
  '⬅️': '左移',
  '➡️': '右移',
  '⬆️': '上移',
  '⬇️': '下移',
};

export type UploadFileInfo = {
  filename: string;
  file_size: number;
  id?: string;
  is_clip: boolean;
};

export type UploadedFileData = {
  id: number;
  upload_filename: string;
  upload_url: string;
};

export enum DimensionsType {
  Portrait = '--ar 2:3',
  Square = '--ar 1:1',
  Landscape = '--ar 3:2',
}

export const DimensionsList = [
  DimensionsType.Landscape,
  DimensionsType.Square,
  DimensionsType.Portrait,
];

export const getAllComponents = (
  components: MessageComponent[],
): MessageSubComponent[] => {
  const result: MessageSubComponent[] = [];
  for (const v of components) {
    if (v.type === 1) {
      for (const b of v.components) {
        result.push(b);
      }
    }
  }
  return result;
};
