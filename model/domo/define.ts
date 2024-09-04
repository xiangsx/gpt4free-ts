import {
  ApplicationCommand,
  ApplicationCommandType,
  MessageFlags,
  DiscordAccount,
} from '../discord/define';
import exp from 'constants';

export interface Account extends DiscordAccount {
  mode: DomoSpeedMode;
  profile?: DomoProfileInfo;
}

export const DomoApplicationID = '1153984868804468756';

export const InfoCommand: ApplicationCommand = {
  id: '1153989567481913365',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: DomoApplicationID,
  version: '1153989567481913369',
  name: 'info',
  description: 'View information about your profile.',
  integration_types: [0],
  global_popularity_rank: 4,
  options: [],
  description_localized: 'View information about your profile.',
  name_localized: 'info',
};

export const VideoCommand: ApplicationCommand = {
  id: '1184104236766740522',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: DomoApplicationID,
  version: '1187394288963829810',
  name: 'video',
  description: 'Turn video into video.',
  options: [
    {
      type: 11,
      name: 'video',
      description: 'Upload the original video for generation.',
      required: true,
      description_localized: 'Upload the original video for generation.',
      name_localized: 'video',
    },
    {
      type: 3,
      name: 'prompt',
      description: 'The prompt to generate.',
      required: true,
      description_localized: 'The prompt to generate.',
      name_localized: 'prompt',
    },
  ],
  dm_permission: true,
  integration_types: [0],
  global_popularity_rank: 1,
  description_localized: 'Turn video into video.',
  name_localized: 'video',
};

export const AnimateCommand: ApplicationCommand = {
  id: '1164545300099239957',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: DomoApplicationID,
  version: '1229349761581318197',
  name: 'animate',
  description: 'Turn image into video.',
  options: [
    {
      type: 11,
      name: 'image',
      description: 'Upload an image and AI helps you turn it into a video.',
      required: true,
      description_localized:
        'Upload an image and AI helps you turn it into a video.',
      name_localized: 'image',
    },
    {
      type: 3,
      name: 'prompt',
      description: 'The prompt to generate.',
      required: false,
      autocomplete: false,
      description_localized: 'The prompt to generate.',
      name_localized: 'prompt',
    },
  ],
  dm_permission: true,
  integration_types: [0],
  global_popularity_rank: 3,
  description_localized: 'Turn image into video.',
  name_localized: 'animate',
};

export const GenCommand: ApplicationCommand = {
  id: '1153989567481913367',
  type: ApplicationCommandType.CHAT_INPUT,
  application_id: DomoApplicationID,
  version: '1195397958552780890',
  name: 'gen',
  description: 'Turn words into art.',
  options: [
    {
      type: 3,
      name: 'prompt',
      description: 'The prompt to generate.',
      required: true,
      description_localized: 'The prompt to generate.',
      name_localized: 'prompt',
    },
    {
      type: 4,
      name: 'model',
      description: 'Model to use for the image.',
      choices: [
        {
          name: '🤩 anixl v1 : Enhanced anime models',
          value: 10017,
          name_localized: '🤩 anixl v1 : Enhanced anime models',
        },
        {
          name: '🤩 anixl v2 : Detail anime model',
          value: 10026,
          name_localized: '🤩 anixl v2 : Detail anime model',
        },
        {
          name: '🤩 realxl v1 : Enhanced realistic model',
          value: 10018,
          name_localized: '🤩 realxl v1 : Enhanced realistic model',
        },
        {
          name: '🤩 realxl v2 : Dark gothic style',
          value: 10027,
          name_localized: '🤩 realxl v2 : Dark gothic style',
        },
        {
          name: '🤩 illusxl v1 : Enhanced illustration model',
          value: 10019,
          name_localized: '🤩 illusxl v1 : Enhanced illustration model',
        },
        {
          name: '🤩 illusxl v2 : Dark comic style',
          value: 10020,
          name_localized: '🤩 illusxl v2 : Dark comic style',
        },
        {
          name: 'ani v1 : Dreamy japanese anime',
          value: 10022,
          name_localized: 'ani v1 : Dreamy japanese anime',
        },
        {
          name: 'ani v2 : Japanese anime style, more 3D',
          value: 10011,
          name_localized: 'ani v2 : Japanese anime style, more 3D',
        },
        {
          name: 'ani v3 : American comics style',
          value: 10012,
          name_localized: 'ani v3 : American comics style',
        },
        {
          name: 'ani v4 : CG style',
          value: 10006,
          name_localized: 'ani v4 : CG style',
        },
        {
          name: 'ani v5 : Line comic style',
          value: 10023,
          name_localized: 'ani v5 : Line comic style',
        },
        {
          name: 'ani v6 : Watercolor anime',
          value: 10024,
          name_localized: 'ani v6 : Watercolor anime',
        },
        {
          name: 'ani v7 : Oilpainting anime',
          value: 10025,
          name_localized: 'ani v7 : Oilpainting anime',
        },
        {
          name: 'illus v1 : 3D cartoon style',
          value: 10028,
          name_localized: 'illus v1 : 3D cartoon style',
        },
        {
          name: 'illus v2 : Storybook cartoon style',
          value: 10029,
          name_localized: 'illus v2 : Storybook cartoon style',
        },
        {
          name: 'real v1 : CG art',
          value: 10030,
          name_localized: 'real v1 : CG art',
        },
        {
          name: 'real v2 : Realistic portrait',
          value: 10031,
          name_localized: 'real v2 : Realistic portrait',
        },
        {
          name: 'real v3 : Game character style',
          value: 10016,
          name_localized: 'real v3 : Game character style',
        },
      ],
      description_localized: 'Model to use for the image.',
      name_localized: 'model',
    },
    {
      type: 11,
      name: 'img2img',
      description: 'Upload an image for reference.',
      description_localized: 'Upload an image for reference.',
      name_localized: 'img2img',
    },
  ],
  integration_types: [0],
  global_popularity_rank: 3,
  description_localized: 'Turn words into art.',
  name_localized: 'gen',
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
  Gen = 'gen',
  Component = 'component',
  Animate = 'animate',
}

export type AIAction = {
  type: AIActionType;
  prompt?: string;
  flags?: MessageFlags;
  reference_prompt?: string;
  model?: number;
  channel_id?: string;
  message_id?: string;
  custom_id?: string;
  image_url?: string;
  component_type?: number;
};

export const ComponentLabelMap: Record<string, string> = {
  U1: '放大第一张',
  U2: '放大第二张',
  U3: '放大第三张',
  U4: '放大第四张',
  V1: '第一张变体',
  V2: '第二张变体',
  V3: '第三张变体',
  V4: '第四张变体',
  'Intensity: low': '低变化度',
  'Intensity: mid': '中变化度',
  'Intensity: high': '高变化度',
  'Gen 3s (Avg. waiting 2.5 min)': '3s视频',
  'Gen 5s (Avg. waiting 4.5 min)': '5s视频',
  Start: '开始生成 ✅',
  '⬅️': '左移',
  '➡️': '右移',
  '⬆️': '上移',
  '⬇️': '下移',
  'Re-generate': '重新生成',
  Vary: '变体',
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

export interface DomoProfileInfo {
  domoUid: string;
  subscriptionType: string;
  subscriptionStatus: string;
  currentMode: string;
  subscriptionCreditsBalance: number;
  paidCreditsBalance: number;
}

export const parseMJProfile = (dataString: string): DomoProfileInfo => {
  const regexPatterns: Record<string, RegExp> = {
    domoUid: /\*\*Domo UID\*\*:\s+(\d+)/,
    subscriptionType: /\*\*Subscription\*\*:\s+([^(]+)/,
    subscriptionStatus: /\*\*Subscription\*\*:.*\((\w+)\)/,
    currentMode: /\*\*Current mode\*\*:\s+(\w+)/,
    subscriptionCreditsBalance: /\*\*Subscription Credits Balance\*\*:\s+(\d+)/,
    paidCreditsBalance: /\*\*Paid Credits Balance\*\*:\s+(\d+)/,
  };

  const result: DomoProfileInfo = {
    domoUid: '',
    subscriptionType: '',
    subscriptionStatus: '',
    currentMode: '',
    subscriptionCreditsBalance: 0,
    paidCreditsBalance: 0,
  };

  Object.keys(regexPatterns).forEach((key) => {
    const match = dataString.match(regexPatterns[key]);
    if (match) {
      // 直接转换为数值的字段
      if (['subscriptionCreditsBalance', 'paidCreditsBalance'].includes(key)) {
        // @ts-ignore
        result[key] = parseInt(match[1], 10);
      } else {
        // @ts-ignore
        result[key] = match[1];
      }
    }
  });

  return result;
};

export enum DomoSpeedMode {
  Relax = 'relax',
  Fast = 'fast',
}

enum ArtStyle {
  // Fusion Style v1 - 可通过提示定义任意风格
  FusionStyleV1 = '15014',
  // Anime v1.1 - 平面色彩动漫风格 2.0
  AnimeV11FlatColor = '15017',
  // Anime v4.1 - 中国水墨画风格 2.0
  AnimeV41ChineseInkPainting = '15018',
  // Anime v5.1 - 日本动漫风格 2.1
  AnimeV51JapaneseAnime = '15016',
  // Anime v6 - 详细动漫风格 2.0
  AnimeV6DetailAnimeStyle = '15015',
  // Illustration v1.1 - 3D 卡通风格 2.0
  IllustrationV11Cartoon3D = '15019',
  // Illustration v3.1 - 像素风格 2.0
  IllustrationV31PixelStyle = '15020',
  // Illustration v7.1 - 纸艺风格 2.0
  IllustrationV71PaperArt = '15021',
  // Anime v1 - 平面色彩动漫风格
  AnimeV1FlatColor = '15001',
  // Anime v2 - 日本动漫风格
  AnimeV2JapaneseAnime = '15005',
  // Anime v3 - 实景动漫风格
  AnimeV3LiveAnime = '15006',
  // Anime v4 - 中国水墨画风格
  AnimeV4ChineseInkPainting = '15010',
  // Illustration v1 - 3D 卡通风格
  IllustrationV1Cartoon3D = '15002',
  // Illustration v2 - 漫画风格
  IllustrationV2ComicStyle = '15003',
  // Illustration v3 - 像素风格
  IllustrationV3PixelStyle = '15004',
  // Illustration v4 - 绘本卡通
  IllustrationV4StorybookCartoon = '15007',
  // Illustration v5 - 彩色插画
  IllustrationV5ColorIllustration = '15008',
  // Illustration v6 - 大盗游戏风格
  IllustrationV6GrandTheftGame = '15009',
  // Illustration v7 - 纸艺风格
  IllustrationV7PaperArt = '15011',
  // Illustration v8 - 梵高风格
  IllustrationV8VanGoghStyle = '15012',
}

export const ArtStyleDescriptions: { [key: string]: string } = {
  '15014': '可通过提示定义任意风格',
  '15017': '平面色彩动漫风格 2.0',
  '15018': '中国水墨画风格 2.0',
  '15016': '日本动漫风格 2.1',
  '15015': '详细动漫风格 2.0',
  '15019': '3D 卡通风格 2.0',
  '15020': '像素风格 2.0',
  '15021': '纸艺风格 2.0',
  '15001': '平面色彩动漫风格',
  '15005': '日本动漫风格',
  '15006': '实景动漫风格',
  '15010': '中国水墨画风格',
  '15002': '3D 卡通风格',
  '15003': '漫画风格',
  '15004': '像素风格',
  '15007': '绘本卡通',
  '15008': '彩色插画',
  '15009': '大盗游戏风格',
  '15011': '纸艺风格',
  '15012': '梵高风格',
};
