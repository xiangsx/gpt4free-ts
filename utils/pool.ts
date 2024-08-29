import { v4 } from 'uuid';
import winston from 'winston';
import moment from 'moment';
import { ComError, parseJSON, shuffleArray } from './index';
import fs from 'fs';
import { fileDebouncer } from './file';
import path from 'path';
import { newLogger } from './log';
import { jsonArrayToMarkdownTable, markdownToHTML } from './web';

const PoolDir = './run/pool';

export interface Info {
  id: string;
  ready: boolean;
}

interface PoolChild<T extends Info> {
  get info(): T;

  update(v: Partial<T>): void;

  // 初始化
  init(): Promise<void>;

  use(): void;

  // 完成调用，释放
  release(): void;

  // 销毁，删除数据
  destroy(options?: DestroyOptions): void;

  initFailed(e?: Error): void;
}

export interface ComInfo extends Info {
  useCount: number;
  lastUseTime: number;
}

export interface DestroyOptions {
  delFile: boolean;
  delMem: boolean;
}

export interface ChildOptions {
  onUpdate: () => void;
  onDestroy: (options?: DestroyOptions) => void;
  onRelease: () => void;
  onInitFailed: (options?: DestroyOptions) => void;
  onUse: () => void;
}

export class ComChild<T extends ComInfo> implements PoolChild<T> {
  private _info: T;
  protected options: ChildOptions | undefined;
  protected logger: winston.Logger;

  constructor(label: string, info: T, options?: ChildOptions) {
    this.logger = newLogger(label);
    this._info = info;
    this.options = options;
  }

  get info() {
    return this._info;
  }

  public update(v: Partial<T>) {
    Object.assign(this._info, v);
    this.options?.onUpdate();
  }

  init(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public use(): void {
    this.options?.onUse();
    // @ts-ignore
    this.update({
      lastUseTime: moment().unix(),
      useCount: (this._info.useCount || 0) + 1,
    });
  }

  public destroy(options?: DestroyOptions): void {
    this.options?.onDestroy(options);
  }

  public release(): void {
    this.options?.onRelease();
  }

  public initFailed(e?: Error): void {
    this.options?.onInitFailed({ delFile: false, delMem: true });
  }
}

interface PoolOptions<T extends Info> {
  delay?: number;
  // 串行
  serial?: number | (() => number);
  preHandleAllInfos?: (allInfos: T[]) => Promise<T[]>;
  needDel?: (info: T) => boolean;
}

// 根据maxsize控制创建的数量
// 根据delay控制创建的速度
// 根据children控制创建的对象
// 根据filepath控制保存的路径
// 根据child.valid()判断历史数据是否有效，并如果true则创建并传入历史数据，整个pool的Info历史数据需要保存到文件中，以便下次启动时读取，保存路径由用户指定
// 需要实现方法 pop(弹出一个空闲的child), init(不断定时检测child的数量，维持在maxsize，并打印当前空闲的child数量)
export class Pool<U extends Info, T extends PoolChild<U>> {
  private readonly using: Set<string> = new Set();
  private allInfos: U[] = [];
  private children: T[] = [];
  private readonly childMap: Map<string, T> = new Map();
  private readonly logger: winston.Logger;
  private readonly filepath: string;
  private creating = 0;

  constructor(
    private readonly label: string = 'Unknown',
    private readonly maxsize: () => number = () => 0,
    private readonly createChild: (info: U, options: ChildOptions) => T,
    private readonly isInfoValid: (info: U) => boolean,
    private readonly options?: PoolOptions<U>,
  ) {
    this.logger = newLogger(label);
    this.filepath = path.join(PoolDir, `${this.label}.json`);

    this.init().then();
  }

  private read() {}

  private save() {
    fileDebouncer.writeFileSync(this.filepath, this.stringify());
  }

  private del(id: string, delFile: boolean, delMem: boolean) {
    if (delMem) {
      this.childMap.delete(id);
      this.children = this.children.filter((child) => child.info.id !== id);
    }
    if (delFile) {
      this.allInfos = this.allInfos.filter((v) => v.id !== id);
      this.save();
    }
  }

  private stringify() {
    return JSON.stringify(this.allInfos);
  }

  private getOneOldInfo() {
    const randomIndex = Math.floor(Math.random() * this.allInfos.length);
    for (let idx = 0; idx < this.allInfos.length; idx++) {
      const i = (randomIndex + idx) % this.allInfos.length;
      const info = this.allInfos[i];
      if (!this.childMap.has(info.id) && this.isInfoValid(info)) {
        this.logger.debug(`get valid: ${i}/${this.allInfos.length}`);
        return info;
      }
    }
  }

  async create() {
    const oldInfo = this.getOneOldInfo();
    const info = oldInfo || ({ id: v4(), ready: false } as U);
    const child = this.createChild(info, {
      onUpdate: () => {
        this.save();
      },
      onDestroy: (options) => {
        const { delFile = false, delMem = true } = options || {};
        if (delMem) {
          this.del(info.id, delFile, delMem);
          this.using.delete(info.id);
        }
      },
      onRelease: () => {
        this.using.delete(info.id);
      },
      onUse: () => {
        this.using.add(info.id);
      },
      onInitFailed: (options) => {
        const { delFile = false, delMem = true } = options || {};
        this.del(info.id, delFile, delMem);
        this.using.delete(info.id);
      },
    });
    child.update({ ready: false } as Partial<U>);
    if (!oldInfo) {
      this.allInfos.push(child.info);
      this.save();
    }
    this.children.push(child);
    this.childMap.set(child.info.id, child);
    let start = Date.now();
    await child
      .init()
      .then(() => {
        child.update({ ready: true } as Partial<U>);
        let init_time = Date.now() - start;
        this.logger.info(
          `[${init_time} ms] create new child ok, current ready size: ${this.children.reduce(
            (prev, cur) => prev + (cur.info.ready ? 1 : 0),
            0,
          )}/${this.maxsize()}`,
          { init_time },
        );
      })
      .catch((e) => {
        this.logger.error(`create new child failed: ${e.message}`);
        try {
          child.initFailed(e);
        } catch (e: any) {
          this.logger.error('init failed run failed:', e.message);
        }
      });
    return true;
  }

  async init() {
    if (!fs.existsSync(PoolDir)) {
      fs.mkdirSync(PoolDir, { recursive: true });
    }
    if (!fs.existsSync(this.filepath)) {
      fs.writeFileSync(this.filepath, this.stringify());
    }

    const str = fs.readFileSync(this.filepath, { encoding: 'utf-8' });
    this.allInfos = parseJSON<U[]>(str, []);
    if (this.options?.preHandleAllInfos) {
      this.allInfos = await this.options.preHandleAllInfos(this.allInfos);
    }
    if (this.options?.needDel) {
      this.allInfos = this.allInfos.filter(
        (info) => !this.options!.needDel!(info),
      );
      this.save();
    }
    this.logger.info('read old info ok, total: ' + this.allInfos.length);

    setInterval(async () => {
      if (this.options?.preHandleAllInfos) {
        this.allInfos = await this.options.preHandleAllInfos(this.allInfos);
      }
      const maxSize = +this.maxsize() || 0;
      if (this.options?.serial) {
        const serials =
          this.options.serial instanceof Function
            ? this.options.serial()
            : this.options.serial;
        if (serials && this.creating >= serials) {
          return;
        }
      }
      if (this.children.length === maxSize) {
        return;
      }
      if (this.children.length > maxSize) {
        // 随机剔除一个
        const randomIndex = Math.floor(Math.random() * this.children.length);
        for (let idx = 0; idx < this.children.length; idx++) {
          const i = (randomIndex + idx) % this.children.length;
          const child = this.children[i];
          if (!this.using.has(child.info.id)) {
            child.destroy({ delFile: false, delMem: true });
            this.logger.info(
              `delete child ok: ${i}/${
                this.children.length
              }, current ready size: ${this.children.reduce(
                (prev, cur) => prev + (cur.info.ready ? 1 : 0),
                0,
              )}/${maxSize}`,
            );
            break;
          }
        }
        return;
      }
      const validInfo = this.allInfos.filter((info) => this.isInfoValid(info));
      this.logger.info(
        `read old info ok, total: ${this.allInfos.length}, valid: ${validInfo.length}, creating: ${this.creating}`,
      );
      this.creating += 1;
      await this.create();
      this.creating -= 1;
    }, this.options?.delay || 5000);
  }

  // 从children中弹出一个空闲的child
  // 如果没有空闲的child，则等待
  // 如果有空闲的child，则返回
  // 如果有空闲的child，但是child的数量小于maxsize，则创建一个新的child
  async pop(): Promise<T> {
    // 随机从数组中的随机位置开始遍历，避免每次都从头开始遍历，遍历全部元素
    const randomIndex = Math.floor(Math.random() * this.children.length);

    for (let idx = 0; idx < this.children.length; idx++) {
      const i = (randomIndex + idx) % this.children.length;
      const child = this.children[i];
      if (!this.using.has(child.info.id) && child.info.ready) {
        this.logger.debug(`pop idx:${i}/${this.children.length}`);
        child.use();
        return child;
      }
    }
    throw new ComError(
      '当前模型负载较高，请稍候重试，或者切换其他模型',
      ComError.Status.RequestTooMany,
    );
  }

  async popIf(condition: (v: U) => boolean) {
    const randomIndex = Math.floor(Math.random() * this.children.length);

    for (let idx = 0; idx < this.children.length; idx++) {
      const i = (randomIndex + idx) % this.children.length;
      const child = this.children[i];
      if (
        !this.using.has(child.info.id) &&
        child.info.ready &&
        condition(child.info)
      ) {
        this.logger.debug(`pop idx:${i}/${this.children.length}`);
        child.use();
        return child;
      }
    }
    throw new ComError(
      '当前模型负载较高，请稍候重试，或者切换其他模型',
      ComError.Status.RequestTooMany,
    );
  }

  getValidInfos() {
    return this.allInfos.filter((info) => this.isInfoValid(info));
  }

  getAllInfos() {
    return this.allInfos;
  }

  findOne(func: (v: U) => boolean) {
    return this.allInfos.find(func);
  }

  updateOneInfo(id: string, v: Partial<U>) {
    const info = this.allInfos.find((v) => v.id === id);
    if (info) {
      Object.assign(info, v);
      this.save();
    }
  }
  // 转成 html 展示详细 info 列表
  showInfosWithMarkdown(title?: string) {
    return markdownToHTML(
      title || `${process.env['apm.serviceName']}:${this.label}`,
      jsonArrayToMarkdownTable(this.allInfos),
    );
  }
}

class PuppeteerUserDirPool {
  static SiteDir = './run/site';
  private siteMap: Record<string, string[]> = {};
  private using: Set<string> = new Set();

  constructor() {
    this.readOldSite();
  }

  private readOldSite() {
    const siteDir = PuppeteerUserDirPool.SiteDir;
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }
    const sites = fs.readdirSync(siteDir);
    for (const site of sites) {
      const sitePath = path.join(siteDir, site);
      const list = fs.readdirSync(sitePath);
      this.siteMap[site] = list;
    }
  }

  popUserDir(site: string) {
    let siteUserDirs = this.siteMap[site];
    let id: string;
    if (!siteUserDirs) {
      siteUserDirs = [];
      this.siteMap[site] = siteUserDirs;
      fs.mkdirSync(path.join(PuppeteerUserDirPool.SiteDir, site), {
        recursive: true,
      });
    }
    for (const user of siteUserDirs) {
      if (!this.using.has(user)) {
        this.using.add(user);
        const p = path.join(PuppeteerUserDirPool.SiteDir, site, user);
        fs.rmSync(path.join(p, 'SingletonLock'), {
          force: true,
          recursive: true,
        });
        return p;
      }
    }
    id = v4();
    siteUserDirs.push(id);
    this.using.add(id);
    return path.join(PuppeteerUserDirPool.SiteDir, site, id);
  }

  releaseUserDir(userDir: string) {
    const id = path.basename(userDir);
    this.using.delete(id);
  }
}

export const puppeteerUserDirPool = new PuppeteerUserDirPool();
