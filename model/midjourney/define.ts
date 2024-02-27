import {
  ApplicationCommand,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  DiscordAccount,
} from '../discord/define';

export interface Account extends DiscordAccount {
  mode: MJSpeedMode;
  profile?: MJProfileInfo;
  blocked?: boolean;
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

export interface MJProfileInfo {
  userId: string;
  subscriptionRenew: number; // 时间戳
  fastTimeRemainingMinutes: number;
  totalFastTimeMinutes: number;
  lifetimeUsageImages: number;
  lifetimeUsageHours: number; // 转换为分钟
  relaxedUsageImages: number;
  relaxedUsageHours: number; // 转换为分钟
  queuedJobsFast: number;
  queuedJobsRelax: number;
}

export const parseMJProfile = (dataString: string): MJProfileInfo => {
  const regexPatterns: Record<string, RegExp> = {
    userId: /\*\*User ID\*\*:\s+([^\n]+)/,
    subscriptionRenew: /\*\*Subscription\*\*:.*<t:(\d+)>/,
    fastTimeRemainingMinutes:
      /\*\*Fast Time Remaining\*\*:\s+([\d.]+)\/([\d.]+) hours/,
    lifetimeUsageImages: /\*\*Lifetime Usage\*\*:\s+(\d+) images/,
    lifetimeUsageHours: /\*\*Lifetime Usage\*\*.*\(([\d.]+) hours\)/,
    relaxedUsageImages: /\*\*Relaxed Usage\*\*:\s+(\d+) images/,
    relaxedUsageHours: /\*\*Relaxed Usage\*\*.*\(([\d.]+) hours\)/,
    queuedJobsFast: /\*\*Queued Jobs \(fast\)\*\*:\s+(\d+)/,
    queuedJobsRelax: /\*\*Queued Jobs \(relax\)\*\*:\s+(\d+)/,
  };

  const result: MJProfileInfo = {
    userId: '',
    subscriptionRenew: 0,
    fastTimeRemainingMinutes: 0,
    totalFastTimeMinutes: 0,
    lifetimeUsageImages: 0,
    lifetimeUsageHours: 0,
    relaxedUsageImages: 0,
    relaxedUsageHours: 0,
    queuedJobsFast: 0,
    queuedJobsRelax: 0,
  };

  Object.keys(regexPatterns).forEach((key) => {
    const match = dataString.match(regexPatterns[key]);
    if (match) {
      // 对特定字段进行数值转换
      switch (key) {
        case 'fastTimeRemainingMinutes':
          result.fastTimeRemainingMinutes = parseFloat(match[1]) * 60;
          result.totalFastTimeMinutes = parseFloat(match[2]) * 60;
          break;
        case 'lifetimeUsageHours':
        case 'relaxedUsageHours':
          result[key] = parseFloat(match[1]) * 60;
          break;
        default:
          // @ts-ignore
          result[key] = isNaN(parseInt(match[1]))
            ? match[1]
            : parseInt(match[1]);
      }
    }
  });

  return result;
};

export enum MJSpeedMode {
  Relax = 'relax',
  Fast = 'fast',
  Turbo = 'turbo',
}
