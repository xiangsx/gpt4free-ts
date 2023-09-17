import { v4 } from 'uuid';
import winston from 'winston';
import moment from 'moment';
import { parseJSON, shuffleArray } from './index';
import fs from 'fs';
import { fileDebouncer } from './file';
import path from 'path';
import { newLogger } from './log';

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
  destroy(): void;
}

export interface ComInfo extends Info {
  useCount: number;
  lastUseTime: number;
}

interface DestroyOptions {
  delFile: boolean;
  createNew: boolean;
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
  private logger: winston.Logger;

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
}

interface PoolOptions {
  delay?: number;
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

  constructor(
    private readonly label: string = 'Unknown',
    private readonly maxsize: () => number = () => 0,
    private readonly createChild: (info: U, options: ChildOptions) => T,
    private readonly isInfoValid: (info: U) => boolean,
    private readonly options?: PoolOptions,
  ) {
    this.logger = newLogger(label);
    this.filepath = path.join(PoolDir, `${this.label}.json`);

    this.init().then();
  }

  private read() {}

  private save() {
    fileDebouncer.writeFileSync(this.filepath, this.stringify());
  }

  private del(id: string, delFile?: boolean) {
    this.childMap.delete(id);
    this.children = this.children.filter((child) => child.info.id !== id);
    if (delFile) {
      this.allInfos = this.allInfos.filter((v) => v.id !== id);
      this.save();
    }
  }

  private stringify() {
    return JSON.stringify(this.allInfos);
  }

  private getOneOldInfo() {
    for (let i = 0; i < this.allInfos.length; i++) {
      if (
        !this.childMap.has(this.allInfos[i].id) &&
        this.isInfoValid(this.allInfos[i])
      ) {
        return this.allInfos[i];
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
        const { delFile = false, createNew = true } = options || {};
        if (createNew) {
          this.del(info.id, delFile);
        }
      },
      onRelease: () => {
        this.using.delete(info.id);
      },
      onUse: () => {
        this.using.add(info.id);
      },
      onInitFailed: (options) => {
        const { delFile = false, createNew = true } = options || {};
        if (createNew) {
          this.del(info.id, delFile);
        }
      },
    });
    child.update({ ready: false } as Partial<U>);
    if (!oldInfo) {
      this.allInfos.push(child.info);
      this.save();
    }
    this.children.push(child);
    this.childMap.set(child.info.id, child);
    child
      .init()
      .then(() => {
        child.update({ ready: true } as Partial<U>);
        this.logger.info(
          `create new child ok, current ready size: ${this.children.reduce(
            (prev, cur) => prev + (cur.info.ready ? 1 : 0),
            0,
          )}/${this.maxsize()}`,
        );
      })
      .catch((e) => this.logger.error(`create new child failed: ${e}`));
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
    this.logger.info('read old info ok, total: ' + this.allInfos.length);

    setInterval(() => {
      if (this.children.length === this.maxsize()) {
        return;
      }
      if (this.children.length > this.maxsize()) {
        // 随机剔除一个
        return;
      }
      this.create();
    }, this.options?.delay || 5000);
  }

  // 从children中弹出一个空闲的child
  // 如果没有空闲的child，则等待
  // 如果有空闲的child，则返回
  // 如果有空闲的child，但是child的数量小于maxsize，则创建一个新的child
  async pop(): Promise<T | undefined> {
    const children = shuffleArray(this.children);
    for (let i = 0; i < children.length; i++) {
      if (!this.using.has(children[i].info.id)) {
        children[i].use();
        return children[i];
      }
    }
  }
}
