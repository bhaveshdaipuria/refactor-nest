import { Injectable, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { cachedKeys } from '../utils';

@Injectable()
export class RedisManager {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async set(key: string, value: any) {
    await this.redis.set(key, JSON.stringify(value));
  }

  async get(key: string) {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async deleteByPattern(pattern: string) {
    const keys = await this.redis.keys(pattern);
    if (keys.length) {
      await this.redis.del(keys);
    }
  }

  async setWithTTL(key: string, value: any, ttl: number) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async clearAllKeys() {
    await this.getKeysByPattern(cachedKeys.CN_LIST + ":*");
    await this.getKeysByPattern(cachedKeys.CANDIDATES + ":*");
    await this.getKeysByPattern(cachedKeys.PARTY + ":*");
    await this.redis.del(cachedKeys.CANDIDATES);
    await this.redis.del(cachedKeys.CONSTITUENCY);
    await this.redis.del(cachedKeys.HOT_CANDIDATES);
    await this.redis.del(cachedKeys.PARTY);
    await this.redis.del(cachedKeys.ASSEMBLY_ELECTION);
    await this.redis.del(cachedKeys.CN_LIST);
    await this.redis.del(cachedKeys.STATE_ELECTION);
    await this.redis.del(cachedKeys.ELECTION);
    await this.getKeysByPattern(cachedKeys.ASSEMBLY_ELECTION + ":*");
    await this.getKeysByPattern(cachedKeys.WIDGET + "_*");
  }

  async getKeysByPattern(pattern: string) {
    const keys = await this.redis.keys(pattern);
    for (const key of keys) {
      await this.redis.del(key);
    }
  }
}

