import Redis from 'ioredis';
import { Config } from './config';
import { newLogger } from './log';
import { Logger } from 'winston';

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

  async add(value: string): Promise<void> {
    this.logger.debug(`add ${value}`);
    await this.redis.sadd(this.key, value);
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
