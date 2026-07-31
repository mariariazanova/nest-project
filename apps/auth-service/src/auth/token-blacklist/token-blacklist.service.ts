import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
    const tokenHash = this.hashToken(token);
    const key = `blacklist:${tokenHash}`;

    try {
      // Store in Redis with TTL matching token expiry
      await this.cacheManager.set(
        key,
        JSON.stringify({
          revokedAt: new Date().toISOString(),
        }),
        expiresInSeconds * 1000, // TTL in milliseconds
      );

      this.logger.log(`Token blacklisted: ${tokenHash.substring(0, 10)}...`);
    } catch (error) {
      this.logger.error(`Failed to blacklist token: ${(error as Error).message}`);
      throw error;
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const key = `blacklist:${tokenHash}`;

    try {
      const result = await this.cacheManager.get(key);
      const isBlacklisted = result !== null && result !== undefined;

      if (isBlacklisted) {
        this.logger.debug(`Token is blacklisted: ${tokenHash.substring(0, 10)}...`);
      }

      return isBlacklisted;
    } catch (error) {
      this.logger.error(`Failed to check token blacklist: ${(error as Error).message}`);
      // Fail closed - treat errors as blacklisted for security
      return true;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
