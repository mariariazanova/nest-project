import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let cacheManager: Cache;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get(TokenBlacklistService);
    cacheManager = module.get(CACHE_MANAGER);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have cacheManager injected', () => {
    expect(cacheManager).toBeDefined();
    expect(cacheManager).toBe(mockCacheManager);
  });

  describe('blacklistToken', () => {
    it('should blacklist token successfully', async () => {
      const token = 'jwt.token.here';
      const expiresInSeconds = 3600; // 1 hour

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expectedKey = `blacklist:${tokenHash}`;
      const expectedTtl = expiresInSeconds * 1000; // Convert to milliseconds

      expect(cacheManager.set).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expectedKey,
        expect.stringContaining('revokedAt'),
        expectedTtl,
      );

      // Verify the stored data structure
      const storedData = JSON.parse(mockCacheManager.set.mock.calls[0][1]);

      expect(storedData).toHaveProperty('revokedAt');
      expect(new Date(storedData.revokedAt)).toBeInstanceOf(Date);
    });

    it('should hash token before storing', async () => {
      const token = 'my.secret.token';
      const expiresInSeconds = 1800;

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
      const expectedKey = `blacklist:${expectedHash}`;

      expect(cacheManager.set).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should store token with correct TTL', async () => {
      const token = 'jwt.token.test';
      const expiresInSeconds = 7200; // 2 hours

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      const expectedTtl = 7200 * 1000; // 7,200,000 milliseconds

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expectedTtl,
      );
    });

    it('should store revokedAt timestamp', async () => {
      const token = 'jwt.token.timestamp';
      const expiresInSeconds = 3600;
      const beforeTime = new Date();

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      const afterTime = new Date();
      const storedData = JSON.parse(mockCacheManager.set.mock.calls[0][1]);
      const revokedAt = new Date(storedData.revokedAt);

      expect(revokedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(revokedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle very short TTL', async () => {
      const token = 'short.ttl.token';
      const expiresInSeconds = 10; // 10 seconds

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        10000, // 10 seconds in milliseconds
      );
    });

    it('should handle long TTL', async () => {
      const token = 'long.ttl.token';
      const expiresInSeconds = 86400; // 24 hours

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        86400000, // 24 hours in milliseconds
      );
    });

    it('should throw error if cacheManager.set fails', async () => {
      const token = 'failing.token';
      const expiresInSeconds = 3600;
      const error = new Error('Redis connection failed');

      mockCacheManager.set.mockRejectedValue(error);

      await expect(service.blacklistToken(token, expiresInSeconds)).rejects.toThrow(
        'Redis connection failed',
      );

      expect(cacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors', async () => {
      const token = 'network.error.token';
      const expiresInSeconds = 3600;

      mockCacheManager.set.mockRejectedValue(new Error('Network timeout'));

      await expect(service.blacklistToken(token, expiresInSeconds)).rejects.toThrow(
        'Network timeout',
      );
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      const token = 'blacklisted.token';
      const mockData = JSON.stringify({
        revokedAt: new Date().toISOString(),
      });

      mockCacheManager.get.mockResolvedValue(mockData);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expectedKey = `blacklist:${tokenHash}`;

      expect(cacheManager.get).toHaveBeenCalledWith(expectedKey);
      expect(cacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-blacklisted token', async () => {
      const token = 'valid.token';

      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
      expect(cacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should return false when cache returns undefined', async () => {
      const token = 'undefined.token';

      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);
    });

    it('should hash token before checking', async () => {
      const token = 'token.to.hash';

      mockCacheManager.get.mockResolvedValue(null);

      await service.isTokenBlacklisted(token);

      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
      const expectedKey = `blacklist:${expectedHash}`;

      expect(cacheManager.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle empty string token', async () => {
      const token = '';

      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(false);

      const emptyHash = crypto.createHash('sha256').update('').digest('hex');

      expect(cacheManager.get).toHaveBeenCalledWith(`blacklist:${emptyHash}`);
    });

    it('should return true on cache error (fail closed)', async () => {
      const token = 'error.token';

      mockCacheManager.get.mockRejectedValue(new Error('Cache unavailable'));

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true); // Fail closed for security!
      expect(cacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should fail closed on Redis connection error', async () => {
      const token = 'redis.error.token';

      mockCacheManager.get.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true); // Security: deny access on errors
    });

    it('should fail closed on timeout', async () => {
      const token = 'timeout.token';

      mockCacheManager.get.mockRejectedValue(new Error('Request timeout'));

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true); // Security first!
    });

    it('should fail closed on any unexpected error', async () => {
      const token = 'unexpected.error.token';

      mockCacheManager.get.mockRejectedValue(new Error('Unknown error'));

      const result = await service.isTokenBlacklisted(token);

      expect(result).toBe(true);
    });
  });

  describe('hashToken (private method)', () => {
    it('should produce consistent hashes', async () => {
      const token = 'consistent.token';

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, 3600);
      const hash1 = mockCacheManager.set.mock.calls[0][0];

      jest.clearAllMocks();
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, 3600);
      const hash2 = mockCacheManager.set.mock.calls[0][0];

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', async () => {
      const token1 = 'token.one';
      const token2 = 'token.two';

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token1, 3600);
      const hash1 = mockCacheManager.set.mock.calls[0][0];

      jest.clearAllMocks();
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token2, 3600);
      const hash2 = mockCacheManager.set.mock.calls[0][0];

      expect(hash1).not.toBe(hash2);
    });

    it('should produce SHA256 hash', async () => {
      const token = 'sha256.test.token';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      mockCacheManager.get.mockResolvedValue(null);

      await service.isTokenBlacklisted(token);

      const expectedKey = `blacklist:${expectedHash}`;
      expect(cacheManager.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should produce 64-character hex hash', async () => {
      const token = 'hex.length.test';

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, 3600);

      const key = mockCacheManager.set.mock.calls[0][0];
      const hash = key.replace('blacklist:', '');

      expect(hash).toHaveLength(64); // SHA256 = 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // Only hex characters
    });
  });

  describe('Integration: blacklist and check', () => {
    it('should blacklist and then correctly identify blacklisted token', async () => {
      const token = 'integration.test.token';
      const expiresInSeconds = 3600;
      let storedKey: string;
      let storedValue: string;

      mockCacheManager.set.mockImplementation((key, value) => {
        storedKey = key;
        storedValue = value;
        return Promise.resolve();
      });

      mockCacheManager.get.mockImplementation((key) => {
        if (key === storedKey) {
          return Promise.resolve(storedValue);
        }
        return Promise.resolve(null);
      });

      await service.blacklistToken(token, expiresInSeconds);
      const isBlacklisted = await service.isTokenBlacklisted(token);

      expect(isBlacklisted).toBe(true);
      expect(cacheManager.set).toHaveBeenCalledTimes(1);
      expect(cacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should not find non-blacklisted token', async () => {
      const blacklistedToken = 'blacklisted.token';
      const validToken = 'valid.token';
      const expiresInSeconds = 3600;
      let storedKey: string;

      mockCacheManager.set.mockImplementation((key) => {
        storedKey = key;
        return Promise.resolve();
      });

      mockCacheManager.get.mockImplementation((key) => {
        if (key === storedKey) {
          return Promise.resolve('{"revokedAt":"2024-01-01T00:00:00Z"}');
        }
        return Promise.resolve(null);
      });

      await service.blacklistToken(blacklistedToken, expiresInSeconds);

      const isBlacklistedTokenBlacklisted = await service.isTokenBlacklisted(blacklistedToken);
      const isValidTokenBlacklisted = await service.isTokenBlacklisted(validToken);

      expect(isBlacklistedTokenBlacklisted).toBe(true);
      expect(isValidTokenBlacklisted).toBe(false);
    });

    it('should handle multiple tokens independently', async () => {
      const tokens = ['token1', 'token2', 'token3'];
      const storage = new Map<string, string>();

      mockCacheManager.set.mockImplementation((key, value) => {
        storage.set(key, value);
        return Promise.resolve();
      });

      mockCacheManager.get.mockImplementation((key) => {
        return Promise.resolve(storage.get(key) || null);
      });

      await service.blacklistToken(tokens[0], 3600);
      await service.blacklistToken(tokens[1], 3600);

      const results = await Promise.all(tokens.map((token) => service.isTokenBlacklisted(token)));

      expect(results[0]).toBe(true); // token1 blacklisted
      expect(results[1]).toBe(true); // token2 blacklisted
      expect(results[2]).toBe(false); // token3 not blacklisted
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long tokens', async () => {
      const longToken = 'a'.repeat(10000); // 10k characters

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(longToken, 3600);

      expect(cacheManager.set).toHaveBeenCalledTimes(1);

      // Hash should still be 64 chars regardless of input length
      const key = mockCacheManager.set.mock.calls[0][0];
      const hash = key.replace('blacklist:', '');

      expect(hash).toHaveLength(64);
    });

    it('should handle special characters in token', async () => {
      const token = 'token@with#special$characters%^&*()';

      mockCacheManager.set.mockResolvedValue(undefined);

      await expect(service.blacklistToken(token, 3600)).resolves.not.toThrow();

      expect(cacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should handle zero TTL', async () => {
      const token = 'zero.ttl.token';
      const expiresInSeconds = 0;

      mockCacheManager.set.mockResolvedValue(undefined);

      await service.blacklistToken(token, expiresInSeconds);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        0, // 0 milliseconds
      );
    });
  });
});
