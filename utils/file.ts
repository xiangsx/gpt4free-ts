import * as fs from 'fs';
import { PathOrFileDescriptor, WriteFileOptions } from 'fs';

class SyncFileDebouncer {
  private static instance: SyncFileDebouncer;
  private readonly debounceTime: number;
  private timers: { [path: string]: NodeJS.Timeout } = {};

  private constructor(debounceTime: number = 300) {
    this.debounceTime = debounceTime;
  }

  public static getInstance(debounceTime?: number): SyncFileDebouncer {
    if (!SyncFileDebouncer.instance) {
      SyncFileDebouncer.instance = new SyncFileDebouncer(debounceTime);
    }
    return SyncFileDebouncer.instance;
  }

  public writeFileSync(
    file: string,
    data: string | NodeJS.ArrayBufferView,
    options?: WriteFileOptions,
  ) {
    if (this.timers[file]) {
      clearTimeout(this.timers[file]);
    }

    this.timers[file] = setTimeout(() => {
      fs.writeFileSync(file, data);
      delete this.timers[file];
    }, this.debounceTime);
  }
}

// 使用示例
export const fileDebouncer = SyncFileDebouncer.getInstance(500); // 100ms 的 debounce 时间
