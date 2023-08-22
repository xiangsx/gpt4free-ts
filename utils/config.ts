import { existsSync, readFileSync, watch } from 'fs';
import { ModelType, Site } from '../model/base';

// 首先定义配置的数据类型
interface ConfigData {
  site_map: Partial<Record<ModelType, { site: Site; priority: number }[]>>;
  one_api: {
    base_url: string;
    api_key: string;
    proxy: boolean;
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
    if (!existsSync(this.filePath)) {
      // console.log(`Configuration file ${this.filePath} not found. Retrying in 5 seconds...`);
      setTimeout(() => this.watchFile(), 5000);
      return;
    }
    let timeoutId: NodeJS.Timeout | null = null;
    const debounceDelay = 300;

    watch(this.filePath, (event) => {
      if (event === 'change') {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          console.log(
            `Configuration file ${this.filePath} has been changed! Reloading...`,
          );
          this.load();
        }, debounceDelay);
      }
    });
  }
}

export const Config = new BaseConfig();
