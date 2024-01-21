import Redis from 'ioredis';
import { Config } from './config';
import { newLogger } from './log';
import { Logger } from 'winston';
import { parseJSON } from './index';

export let DefaultRedis: Redis;

export function initCache() {
  if (!Config.config.global.redis) {
    setTimeout(() => initCache(), 5000);
    return;
  }
  DefaultRedis = new Redis(Config.config.global.redis);
  DefaultRedis.on('ready', () => {
    console.info(
      `redis[${Config.config.global.redis.host}:${Config.config.global.redis.port}] ready`,
    );
  });
  DefaultRedis.on('error', (e) => {
    console.debug(
      `redis[${Config.config.global.redis.host}:${Config.config.global.redis.port}] failed,${e.message}`,
    );
  });
}

export class StringPool {
  private redis: Redis;
  private readonly key: string;
  private logger!: Logger;

  constructor(redis: Redis, key: string) {
    this.redis = redis;
    this.key = key;
    this.logger = newLogger(`${this.key}`);
  }

  async add(value: string): Promise<number> {
    this.logger.debug(`add ${value}`);
    return this.redis.sadd(this.key, value);
  }

  async remove(value: string): Promise<void> {
    this.logger.debug(`remove ${value}`);
    await this.redis.srem(this.key, value);
  }

  async random(): Promise<string | null> {
    this.logger.debug(`random`);
    return this.redis.srandmember(this.key);
  }

  async size(): Promise<number> {
    this.logger.debug(`size`);
    return this.redis.scard(this.key);
  }

  async clear(): Promise<void> {
    this.logger.debug(`clear`);
    await this.redis.del(this.key);
  }

  // pop
  async pop(): Promise<string | null> {
    this.logger.debug(`pop`);
    return this.redis.spop(this.key);
  }
}

// string类型的key，传入初始化方法
// 如果key不存在，会调用init方法初始化
// key需要有过期时间
// 防止缓存穿透和缓存雪崩
export class CommCache<T> {
  private redis: Redis;
  private readonly _key: string;
  private readonly init?: () => Promise<T | null>;
  private readonly expire: number;
  private logger!: Logger;

  constructor(
    redis: Redis,
    key: string,
    expire: number,
    init?: () => Promise<T | null>,
  ) {
    this.redis = redis;
    this._key = key;
    this.init = init;
    this.expire = expire;
    this.logger = newLogger(`${this._key}`);
  }

  key(subkey: string) {
    return this._key + ':' + subkey;
  }

  async get(subkey: string, init?: () => Promise<T | null>): Promise<T | null> {
    if (!init && !this.init) {
      throw new Error('init is null');
    }
    const initFunc = init || this.init;
    const v = await this.redis.get(this.key(subkey));
    if (v) {
      this.logger.debug(`${subkey} cache got`);
      return parseJSON<T | null>(v, null);
    }
    const nv = await initFunc!();
    const sv = JSON.stringify(nv);
    await this.redis.set(this.key(subkey), sv, 'EX', this.expire);
    this.logger.debug(`${subkey} cache miss`);
    return nv;
  }

  async set(subkey: string, value: string): Promise<void> {
    this.logger.debug(`set ${value}`);
    await this.redis.set(this.key(subkey), value, 'EX', this.expire);
  }

  async clear(subkey: string): Promise<void> {
    this.logger.debug(`clear`);
    await this.redis.del(this.key(subkey));
  }
}
