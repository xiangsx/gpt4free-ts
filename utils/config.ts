import { existsSync, readFileSync, statSync } from 'fs';
import { ModelType, Site } from '../model/base';
import { TempEmailType } from './emailFactory';

export type SiteCfg = {
  site: Site;
  priority: number;
  base_url?: string;
  api_key?: string;
  label?: string;
  proxy?: boolean;
  model_map?: { [key: string]: ModelType };
  condition?: string; // eval function (req:{model,prompt_tokens}):bool
};

type SizeCfg = {
  size: number;
  serial: number;
};

type MailCfg = {
  mail_type: TempEmailType;
};

type DiscordAccount = {
  token: string;
  server_id: string;
  channel_id: string;
};

type GoogleMailAccount = {
  email: string;
  password: string;
  recovery: string;
};

// 首先定义配置的数据类型
interface ConfigData {
  exit: boolean;
  global: {
    trace?: boolean;
    download: {
      proxy?: string;
      dir: string;
    };
    cdn: {
      url: string;
    };
    redis: {
      host: string;
      port: number;
      password: string;
      db: number;
    };
    chrome_path: string;
    download_map?: Record<string, string>;
  };
  proxy_pool: {
    enable: boolean;
    stable_proxy_list: string[];
    proxy_list: string[];
  };
  claudeauto?: SizeCfg & {
    apikey_list: string[];
    proxy_list: string[];
  };
  freegpt4: SizeCfg & MailCfg;
  bingcopilot: SizeCfg;
  gmail_list: { email: string; password: string; recovery_email: string }[];
  hypotenuse: MailCfg & SizeCfg;
  airoom: SizeCfg;
  gptgod: SizeCfg;
  opensess: {
    size: number;
    serial: number;
    mail_type: TempEmailType;
  };
  openai: {
    token_limit: { [key: string]: number };
  };
  glm?: {
    token_limit: { [key: string]: number };
  };
  pika?: SizeCfg & {
    accounts: GoogleMailAccount[];
  };
  midjourney: SizeCfg & {
    accounts: (DiscordAccount & {
      mode: 'relax' | 'fast' | 'turbo';
    })[];
  };
  domo: SizeCfg & {
    accounts: (DiscordAccount & {
      mode: 'relax' | 'fast';
    })[];
  };
  arkose: {
    size: number;
    max_pool_size: number;
    gen_interval: number;
    serial: number;
    allow_3: boolean;
    must_all_tools: boolean;
    must_plus: boolean;
    keep_arkose_refresh?: boolean;
    accounts: { email: string; password: string }[];
  };
  www: SizeCfg;
  ddg: SizeCfg;
  perplexity: {
    size: number;
    tokens: string[];
    serial: number;
    concurrency: number;
    system: string;
    model: ModelType;
  };
  izea: {
    size: number;
    serial: number;
    mail_type: TempEmailType;
  };
  phind: {
    size: number;
    serial: number;
    mail_type: TempEmailType;
  };
  sincode: {
    size: number;
    serial: number;
    concurrency: number;
    accounts: { email: string; password: string }[];
  };
  site_map: Partial<Record<ModelType, SiteCfg[]>>;
  one_api: {
    base_url: string;
    api_key: string;
    proxy: boolean;
  };
  gemini: SizeCfg & {
    apikeys: string[];
  };
  poeauto: {
    size: number;
    serial: number;
    mail_type: TempEmailType;
  };
  poevip: {
    size: number;
    serial: number;
    pb_list: { lat: string; pb: string }[];
  };
  cursor: {
    primary_model: ModelType;
  };
  claudechat: {
    size: number;
    serial: number;
    sessions_keys: string[];
  };
  openchat3: {
    size: number;
    serial: number;
    accounts: { email: string; password: string }[];
  };
  openchat4: {
    size: number;
    serial: number;
    allow_3: boolean;
    must_all_tools: boolean;
    must_plus: boolean;
    keep_arkose_refresh?: boolean;
    upload_url: string;
    download_proxy: string;
    download_map?: Record<string, string>;
    prompt_map?: Record<string, string>;
    system?: string;
    sleep_interval?: number; // 429之后睡眠多久
    accounts: { email: string; password: string }[];
  };
  stack: {
    size: number;
    serial: number;
    mail_type: TempEmailType;
    accounts: {
      email: string;
      password: string;
      flow_id: string;
      token: string;
    }[];
  };
  mixer: { size: number; mailType: TempEmailType; serial: number };
  merlin: { size: number; mailType: TempEmailType; serial: number };
  takeoff: { size: number; mailType: TempEmailType; serial: number };
  askx: { size: number; mailType: TempEmailType; serial: number };
  td: {
    size: number;
    mail_type: TempEmailType;
    serial: number;
    domain: string;
  };
  navit: {
    size: number;
    mailType: TempEmailType;
    serial: number;
    reverse: string;
  };
  airops: {
    size: number;
    mail_type: TempEmailType;
  };
  langdock: {
    size: number;
    mail_type: TempEmailType;
    serial: number;
  };
  vanus: {
    size: number;
    mail_type: TempEmailType;
  };
  // 当添加新字段时，需要在此处更新类型定义
}

class BaseConfig {
  private filePath: string = './run/config.json';
  private defaultConfig: ConfigData = {
    exit: true,
    global: {
      download: {
        dir: './run/file/',
      },
      cdn: {
        url: '',
      },
      redis: {
        host: '',
        port: 0,
        password: '',
        db: 0,
      },
      chrome_path: 'google-chrome',
      download_map: {},
    },
    airoom: {
      size: 0,
      serial: 1,
    },
    gptgod: {
      size: 0,
      serial: 1,
    },
    hypotenuse: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    opensess: {
      size: 0,
      serial: 1,
      mail_type: TempEmailType.TempMailLOL,
    },
    askx: {
      size: 0,
      serial: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    proxy_pool: {
      enable: false,
      stable_proxy_list: [],
      proxy_list: [],
    },
    site_map: {},
    openai: {
      token_limit: {},
    },
    one_api: {
      base_url: '',
      api_key: '',
      proxy: false,
    }, // Add new fields here, with their default values
    cursor: {
      primary_model: ModelType.GPT4,
    },
    td: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.TempMailLOL,
      domain: '',
    },
    mixer: {
      size: 0,
      serial: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    stack: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.TempMailLOL,
      accounts: [],
    },
    takeoff: {
      size: 0,
      serial: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    merlin: {
      size: 0,
      serial: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    navit: {
      size: 0,
      serial: 0,
      mailType: TempEmailType.TempMailLOL,
      reverse: '',
    },
    airops: {
      size: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    langdock: {
      size: 0,
      mail_type: TempEmailType.TempMailLOL,
      serial: 0,
    },
    gemini: {
      size: 0,
      serial: 0,
      apikeys: [],
    },
    sincode: {
      size: 0,
      serial: 0,
      concurrency: 1,
      accounts: [],
    },
    phind: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    izea: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    perplexity: {
      size: 0,
      serial: 0,
      tokens: [],
      concurrency: 1,
      system: '',
      model: ModelType.GPT3p5Turbo,
    },
    vanus: {
      size: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    gmail_list: [],
    claudechat: {
      size: 0,
      serial: 0,
      sessions_keys: [],
    },
    openchat3: {
      size: 0,
      serial: 0,
      accounts: [],
    },
    openchat4: {
      size: 0,
      serial: 0,
      allow_3: false,
      must_plus: false,
      must_all_tools: false,
      accounts: [],
      keep_arkose_refresh: false,
      upload_url: '',
      download_proxy: '',
      download_map: {},
    },
    poeauto: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.SmailPro,
    },
    www: {
      size: 0,
      serial: 1,
    },
    ddg: {
      size: 0,
      serial: 1,
    },
    poevip: {
      size: 0,
      serial: 0,
      pb_list: [],
    },
    arkose: {
      size: 0,
      serial: 0,
      max_pool_size: 0,
      allow_3: false,
      must_plus: false,
      must_all_tools: false,
      accounts: [],
      keep_arkose_refresh: false,
      gen_interval: 10,
    },
    midjourney: {
      size: 0,
      serial: 0,
      accounts: [],
    },
    freegpt4: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    bingcopilot: {
      size: 0,
      serial: 0,
    },
    domo: {
      size: 0,
      serial: 0,
      accounts: [],
    },
  };
  public config: ConfigData;

  constructor() {
    // Initialize config as a deep copy of defaultConfig
    this.config = JSON.parse(JSON.stringify(this.defaultConfig));
  }

  load() {
    if (!existsSync(this.filePath)) {
      // console.log(
      //   `Configuration file ${this.filePath} not found. Retrying in 5 seconds...`,
      // );
      setTimeout(() => this.load(), 5000);
      return;
    }
    try {
      const rawData = readFileSync(this.filePath, 'utf8');
      const fileConfig: Partial<ConfigData> = JSON.parse(rawData);

      // Merge defaultConfig and fileConfig
      this.config = Object.assign(this.config, this.defaultConfig, fileConfig);
      console.log('Loaded config from run/config.json successfully!');
    } catch (error) {
      // console.error(`Error reading or parsing the configuration file ${this.filePath}.`, error);
    }
  }

  watchFile() {
    let lastModifiedTime: Date | null = null;

    // 每隔5秒钟读取一次文件
    const intervalId = setInterval(() => {
      if (!existsSync(this.filePath)) {
        // console.log(
        //   `Configuration file ${this.filePath} not found. Retrying in 5 seconds...`,
        // );
        return;
      }

      try {
        const stats = statSync(this.filePath);
        const newModifiedTime = stats.mtime;

        // 检查文件是否被修改
        if (lastModifiedTime && newModifiedTime > lastModifiedTime) {
          console.log(
            `Configuration file ${this.filePath} has been changed! Reloading...`,
          );
          this.load();
        }

        lastModifiedTime = newModifiedTime;
      } catch (e) {
        console.error(e);
      }
    }, +(process.env.CONFIG_SYNC_INTERVAL || 5000));
  }
}

export const Config = new BaseConfig();
