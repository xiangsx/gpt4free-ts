import Redis from 'ioredis';
import { Config } from './config';

export let DefaultRedis: Redis;

export function initCache() {
  DefaultRedis = new Redis(Config.config.global.redis);
  DefaultRedis.on('ready', () => {
    console.log(
      `redis[${Config.config.global.redis.host}:${Config.config.global.redis.port}] ready`,
    );
  });
  DefaultRedis.on('error', (e) => {
    console.log(
      `redis[${Config.config.global.redis.host}:${Config.config.global.redis.port}] failed,${e.message}`,
    );
  });
}

export class StringPool {
  private redis: Redis;
  private readonly key: string;

  constructor(redis: Redis, key: string) {
    this.redis = redis;
    this.key = key;
  }

  async add(value: string): Promise<void> {
    await this.redis.sadd(this.key, value);
  }

  async remove(value: string): Promise<void> {
    await this.redis.srem(this.key, value);
  }

  async random(): Promise<string | null> {
    return await this.redis.srandmember(this.key);
  }

  async size(): Promise<number> {
    return await this.redis.scard(this.key);
  }

  async clear(): Promise<void> {
    await this.redis.del(this.key);
  }

  // pop
  async pop(): Promise<string | null> {
    return await this.redis.spop(this.key);
  }
}
