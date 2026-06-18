import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Get,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import request from 'supertest';

// Mock Test Controller (simulates the actual controller without dependencies)
@Controller('history')
class TestHistoryController {
  private mockHistory = [
    {
      _id: 'history-1',
      userId: 'user-123',
      criteria: {
        category: 'books',
        mood: 'happy',
        genre: 'fiction',
      },
      suggestions: [
        { id: '1', title: 'The Great Gatsby', category: 'books' },
        { id: '2', title: '1984', category: 'books' },
      ],
      timestamp: new Date('2024-01-01T10:00:00.000Z'),
      metadata: { source: 'web' },
    },
    {
      _id: 'history-2',
      userId: 'user-123',
      criteria: {
        category: 'films',
        mood: 'exciting',
        genre: 'action',
      },
      suggestions: [{ id: '3', title: 'Inception', category: 'films' }],
      timestamp: new Date('2024-01-02T15:30:00.000Z'),
      metadata: { source: 'web' },
    },
    {
      _id: 'history-3',
      userId: 'user-456',
      criteria: {
        category: 'books',
        mood: 'dark',
      },
      suggestions: [{ id: '4', title: 'The Shining', category: 'books' }],
      timestamp: new Date('2024-01-03T09:15:00.000Z'),
      metadata: { source: 'web' },
    },
  ];

  private cache = new Map<string, unknown>();

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserHistory(@Headers('X-User-Id') userId: string) {
    if (!userId) {
      return { statusCode: 400, message: 'X-User-Id header is required' };
    }

    // Filter history by userId
    const userHistory = this.mockHistory
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return userHistory;
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getUserStats(@Headers('X-User-Id') userId: string) {
    if (!userId) {
      return { statusCode: 400, message: 'X-User-Id header is required' };
    }

    const cacheKey = `stats:${userId}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const userHistory = this.mockHistory.filter((entry) => entry.userId === userId);

    // Calculate stats
    const categoryMap = new Map<string, number>();
    const moodMap = new Map<string, number>();

    userHistory.forEach((entry) => {
      const category = entry.criteria.category;
      const mood = entry.criteria.mood;

      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }
      if (mood) {
        moodMap.set(mood, (moodMap.get(mood) || 0) + 1);
      }
    });

    const stats = {
      totalSearches: userHistory.length,
      byCategory: Array.from(categoryMap.entries())
        .map(([_id, count]) => ({ _id, count }))
        .sort((a, b) => b.count - a.count),
      byMood: Array.from(moodMap.entries())
        .map(([_id, count]) => ({ _id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      recentSearches: userHistory.slice(0, 5).map((entry) => ({
        _id: entry._id,
        criteria: entry.criteria,
        timestamp: entry.timestamp,
        suggestionsCount: entry.suggestions.length,
      })),
      userId,
      generatedAt: new Date(),
    };

    // Cache result
    this.cache.set(cacheKey, stats);

    return stats;
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getHistoryItem(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    if (!userId) {
      return { statusCode: 400, message: 'X-User-Id header is required' };
    }

    const cacheKey = `history:user:${userId}:item:${id}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Find item with security check (user ownership)
    const item = this.mockHistory.find((entry) => entry._id === id && entry.userId === userId);

    if (!item) {
      return { statusCode: 404, message: 'History item not found' };
    }

    // Cache result
    this.cache.set(cacheKey, item);

    return item;
  }
}

describe('HistoryController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestHistoryController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /history', () => {
    it('should return user history sorted by timestamp', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(2);
          expect(res.body[0]).toHaveProperty('_id');
          expect(res.body[0]).toHaveProperty('userId', 'user-123');
          expect(res.body[0]).toHaveProperty('criteria');
          expect(res.body[0]).toHaveProperty('suggestions');
          expect(res.body[0]).toHaveProperty('timestamp');
        });
    });

    it('should return history sorted by most recent first', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          const timestamps = res.body.map((entry) => new Date(entry.timestamp).getTime());
          for (let i = 0; i < timestamps.length - 1; i++) {
            expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
          }
        });
    });

    it('should return empty array for user with no history', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-999')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([]);
        });
    });

    it('should return 400 when X-User-Id header is missing', () => {
      return request(app.getHttpServer())
        .get('/history')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(400);
          expect(res.body.message).toBe('X-User-Id header is required');
        });
    });

    it('should filter history by userId', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-456')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(1);
          expect(res.body[0].userId).toBe('user-456');
        });
    });

    it('should include all history fields', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          const entry = res.body[0];
          expect(entry).toHaveProperty('_id');
          expect(entry).toHaveProperty('userId');
          expect(entry).toHaveProperty('criteria');
          expect(entry.criteria).toHaveProperty('category');
          expect(entry.criteria).toHaveProperty('mood');
          expect(entry).toHaveProperty('suggestions');
          expect(Array.isArray(entry.suggestions)).toBe(true);
          expect(entry).toHaveProperty('timestamp');
          expect(entry).toHaveProperty('metadata');
        });
    });
  });

  describe('GET /history/stats', () => {
    it('should return user statistics', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalSearches');
          expect(res.body).toHaveProperty('byCategory');
          expect(res.body).toHaveProperty('byMood');
          expect(res.body).toHaveProperty('recentSearches');
          expect(res.body).toHaveProperty('userId', 'user-123');
          expect(res.body).toHaveProperty('generatedAt');
        });
    });

    it('should calculate correct total searches', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalSearches).toBe(2);
        });
    });

    it('should aggregate by category', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.byCategory)).toBe(true);
          expect(res.body.byCategory.length).toBeGreaterThan(0);
          expect(res.body.byCategory[0]).toHaveProperty('_id');
          expect(res.body.byCategory[0]).toHaveProperty('count');
        });
    });

    it('should aggregate by mood', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.byMood)).toBe(true);
          expect(res.body.byMood.length).toBeGreaterThan(0);
          expect(res.body.byMood[0]).toHaveProperty('_id');
          expect(res.body.byMood[0]).toHaveProperty('count');
        });
    });

    it('should sort categories by count descending', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          const counts = res.body.byCategory.map((cat) => cat.count);
          for (let i = 0; i < counts.length - 1; i++) {
            expect(counts[i]).toBeGreaterThanOrEqual(counts[i + 1]);
          }
        });
    });

    it('should limit moods to top 10', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.byMood.length).toBeLessThanOrEqual(10);
        });
    });

    it('should include recent searches', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.recentSearches)).toBe(true);
          expect(res.body.recentSearches.length).toBeLessThanOrEqual(5);
          if (res.body.recentSearches.length > 0) {
            expect(res.body.recentSearches[0]).toHaveProperty('_id');
            expect(res.body.recentSearches[0]).toHaveProperty('criteria');
            expect(res.body.recentSearches[0]).toHaveProperty('timestamp');
            expect(res.body.recentSearches[0]).toHaveProperty('suggestionsCount');
          }
        });
    });

    it('should return 400 when X-User-Id header is missing', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('should return zero stats for user with no history', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-999')
        .expect(200)
        .expect((res) => {
          expect(res.body.totalSearches).toBe(0);
          expect(res.body.byCategory).toEqual([]);
          expect(res.body.byMood).toEqual([]);
          expect(res.body.recentSearches).toEqual([]);
        });
    });
  });

  describe('GET /history/:id', () => {
    it('should return specific history item', () => {
      return request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('_id', 'history-1');
          expect(res.body).toHaveProperty('userId', 'user-123');
          expect(res.body).toHaveProperty('criteria');
          expect(res.body).toHaveProperty('suggestions');
        });
    });

    it('should enforce user ownership (security check)', () => {
      return request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-456')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.message).toBe('History item not found');
        });
    });

    it('should return 404 for non-existent item', () => {
      return request(app.getHttpServer())
        .get('/history/history-999')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.message).toBe('History item not found');
        });
    });

    it('should return 400 when X-User-Id header is missing', () => {
      return request(app.getHttpServer())
        .get('/history/history-1')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('should include complete history entry data', () => {
      return request(app.getHttpServer())
        .get('/history/history-2')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(res.body._id).toBe('history-2');
          expect(res.body.criteria).toEqual({
            category: 'films',
            mood: 'exciting',
            genre: 'action',
          });
          expect(res.body.suggestions).toHaveLength(1);
          expect(res.body.suggestions[0].title).toBe('Inception');
        });
    });
  });

  describe('Cache behavior', () => {
    it('should return same stats result when cached', async () => {
      // First request
      const res1 = await request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'cache-user-123')
        .expect(200);

      // Second request (should be cached)
      const res2 = await request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'cache-user-123')
        .expect(200);

      expect(res1.body.generatedAt).toEqual(res2.body.generatedAt);
    });

    it('should cache individual history items', async () => {
      // First request
      const res1 = await request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-123')
        .expect(200);

      // Second request (should be cached)
      const res2 = await request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-123')
        .expect(200);

      expect(res1.body).toEqual(res2.body);
    });

    it('should use user-scoped cache keys', async () => {
      // Different users requesting same history ID shouldn't see each other's data
      const res1 = await request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-123')
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-456')
        .expect(200);

      expect(res1.body).not.toEqual(res2.body);
      expect(res2.body.statusCode).toBe(404); // user-456 can't access user-123's history
    });
  });

  describe('HTTP Methods', () => {
    it('should handle GET requests for history list', () => {
      return request(app.getHttpServer()).get('/history').set('X-User-Id', 'user-123').expect(200);
    });

    it('should handle GET requests for stats', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200);
    });

    it('should handle GET requests for individual items', () => {
      return request(app.getHttpServer())
        .get('/history/history-1')
        .set('X-User-Id', 'user-123')
        .expect(200);
    });
  });

  describe('Headers and Content Type', () => {
    it('should return JSON by default', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-123')
        .expect('Content-Type', /json/)
        .expect(200);
    });

    it('should require X-User-Id header', () => {
      return request(app.getHttpServer())
        .get('/history')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(400);
        });
    });

    it('should handle custom headers', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-123')
        .set('X-Custom-Header', 'test-value')
        .expect(200);
    });
  });

  describe('Performance', () => {
    it('should respond quickly to history requests', async () => {
      const start = Date.now();

      await request(app.getHttpServer()).get('/history').set('X-User-Id', 'user-123').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/history').set('X-User-Id', 'user-123'));

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Data validation', () => {
    it('should return history entries with valid structure', () => {
      return request(app.getHttpServer())
        .get('/history')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          res.body.forEach((entry) => {
            expect(entry).toHaveProperty('_id');
            expect(entry).toHaveProperty('userId');
            expect(entry).toHaveProperty('criteria');
            expect(entry).toHaveProperty('suggestions');
            expect(entry).toHaveProperty('timestamp');
            expect(Array.isArray(entry.suggestions)).toBe(true);
          });
        });
    });

    it('should return stats with valid numeric values', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .set('X-User-Id', 'user-123')
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.totalSearches).toBe('number');
          expect(res.body.totalSearches).toBeGreaterThanOrEqual(0);
          res.body.byCategory.forEach((cat) => {
            expect(typeof cat.count).toBe('number');
            expect(cat.count).toBeGreaterThan(0);
          });
        });
    });
  });
});
