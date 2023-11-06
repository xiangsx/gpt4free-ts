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
};
// 首先定义配置的数据类型
interface ConfigData {
  exit: boolean;
  global: {
    chrome_path: string;
  };
  proxy_pool: {
    enable: boolean;
    proxy_list: string[];
  };
  gmail_list: { email: string; password: string; recovery_email: string }[];
  openai: {
    token_limit: { [key: string]: number };
  };
  perplexity: {
    size: number;
    tokens: string[];
    serial: number;
    concurrency: number;
    system: string;
    model: string;
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
  poeauto: {
    size: number;
    serial: number;
    mail_type: TempEmailType;
  };
  poevip: {
    size: number;
    serial: number;
    pb_list: string[];
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
    must_plus: boolean;
    arkose_data?: string[];
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
      chrome_path: 'google-chrome',
    },
    askx: {
      size: 0,
      serial: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    proxy_pool: {
      enable: false,
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
      model: 'perplexity',
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
      arkose_data: [],
      accounts: [],
    },
    poeauto: {
      size: 0,
      serial: 0,
      mail_type: TempEmailType.SmailPro,
    },
    poevip: {
      size: 0,
      serial: 0,
      pb_list: [],
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
