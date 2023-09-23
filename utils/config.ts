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
};
// 首先定义配置的数据类型
interface ConfigData {
  perplexity: {
    size: number;
    tokens: string[];
    concurrency: number;
  };
  site_map: Partial<Record<ModelType, SiteCfg[]>>;
  one_api: {
    base_url: string;
    api_key: string;
    proxy: boolean;
  };
  cursor: {
    primary_model: ModelType;
  };
  mixer: { size: number; mailType: TempEmailType };
  merlin: { size: number; mailType: TempEmailType };
  airops: {
    size: number;
    mail_type: TempEmailType;
  };
  langdock: {
    size: number;
    mail_type: TempEmailType;
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
    site_map: {},
    one_api: {
      base_url: '',
      api_key: '',
      proxy: false,
    }, // Add new fields here, with their default values
    cursor: {
      primary_model: ModelType.GPT4,
    },
    mixer: {
      size: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    merlin: {
      size: 0,
      mailType: TempEmailType.TempMailLOL,
    },
    airops: {
      size: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    langdock: {
      size: 0,
      mail_type: TempEmailType.TempMailLOL,
    },
    perplexity: {
      size: 0,
      tokens: [],
      concurrency: 1,
    },
    vanus: {
      size: 0,
      mail_type: TempEmailType.TempMailLOL,
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
      console.log(
        'Loaded config from run/config.json successfully!',
        JSON.stringify(this.config),
      );
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
