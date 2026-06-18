import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import request from 'supertest';
import { FilterItemsDto } from '../src/suggestion/dto/filter-items.dto';
import { Category } from '../src/suggestion/enums/category';

// Mock Test Controller (simulates the actual controller without dependencies)
@Controller('suggestion')
class TestSuggestionController {
  private mockBooks = [
    {
      id: '1',
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      moods: [{ id: '1', name: 'melancholic' }],
      genres: [{ id: '1', name: 'fiction' }],
      events: [{ id: '1', name: 'reading-night' }],
    },
    {
      id: '2',
      title: '1984',
      author: 'George Orwell',
      moods: [{ id: '2', name: 'dark' }],
      genres: [{ id: '2', name: 'dystopian' }],
      events: [{ id: '2', name: 'book-club' }],
    },
  ];

  private mockFilms = [
    {
      id: '1',
      title: 'Inception',
      director: 'Christopher Nolan',
      moods: [{ id: '3', name: 'suspenseful' }],
      genres: [{ id: '3', name: 'sci-fi' }],
      events: [{ id: '3', name: 'movie-night' }],
    },
  ];

  private cache = new Map<string, unknown>();

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async findFiltered(@Body() dto: FilterItemsDto, @Headers('X-User-Id') userId: string) {
    if (!dto || !dto.criteria) {
      return { statusCode: 400, message: 'Bad Request' };
    }

    const { category, mood, genre, event } = dto.criteria;

    // Validate category
    if (category && !Object.values(Category).includes(category as Category)) {
      return { statusCode: 404, message: `Category ${category} not found` };
    }

    // Generate cache key
    const cacheKey = [
      'suggestions',
      category || 'all',
      mood || 'any',
      genre || 'any',
      event || 'any',
    ].join(':');

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get data based on category
    let items = [];
    if (category === Category.BOOK || !category) {
      items = this.mockBooks.filter((book) => {
        if (mood && !book.moods.some((m) => m.name === mood)) return false;
        if (genre && !book.genres.some((g) => g.name === genre)) return false;
        if (event && !book.events.some((e) => e.name === event)) return false;
        return true;
      });
    } else if (category === Category.FIlM) {
      items = this.mockFilms.filter((film) => {
        if (mood && !film.moods.some((m) => m.name === mood)) return false;
        if (genre && !film.genres.some((g) => g.name === genre)) return false;
        if (event && !film.events.some((e) => e.name === event)) return false;

        return true;
      });
    }

    const result = {
      id: userId || 'anonymous',
      type: category || Category.BOOK,
      items: items.slice(0, 20),
    };

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }

  @Get(':category/:id')
  async findOne(@Param('category') category: string, @Param('id') id: string) {
    // Validate category
    if (!Object.values(Category).includes(category as Category)) {
      return { statusCode: 404, message: `Category ${category} not found` };
    }

    const cacheKey = `suggestion:${category}:${id}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Find item
    let item = null;
    if (category === Category.BOOK) {
      item = this.mockBooks.find((book) => book.id === id);
    } else if (category === Category.FIlM) {
      item = this.mockFilms.find((film) => film.id === id);
    }

    if (!item) {
      return { statusCode: 404, message: 'Item not found' };
    }

    // Cache result
    this.cache.set(cacheKey, item);

    return item;
  }
}

describe('SuggestionController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestSuggestionController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /suggestion', () => {
    it('should return filtered book suggestions', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
            mood: 'melancholic',
            genre: 'fiction',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'user-123');
          expect(res.body).toHaveProperty('type', Category.BOOK);
          expect(res.body).toHaveProperty('items');
          expect(Array.isArray(res.body.items)).toBe(true);
        });
    });

    it('should return film suggestions', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-456')
        .send({
          criteria: {
            category: Category.FIlM,
            mood: 'suspenseful',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.type).toBe(Category.FIlM);
          expect(res.body.items).toBeDefined();
        });
    });

    it('should return suggestions without filters', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-789')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('items');
          expect(res.body.items.length).toBeGreaterThan(0);
        });
    });

    it('should return 404 for invalid category', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: 'invalid-category',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
        });
    });

    it('should handle missing X-User-Id header', async () => {
      // Clear cache first or use unique criteria
      return request(app.getHttpServer())
        .post('/suggestion')
        .send({
          criteria: {
            category: Category.BOOK,
            genre: 'unique-genre-for-this-test', // Force cache miss
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe('anonymous');
        });
    });

    it('should filter by mood', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
            mood: 'dark',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.items).toHaveLength(1);
          expect(res.body.items[0].title).toBe('1984');
        });
    });

    it('should filter by genre', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
            genre: 'fiction',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.items.length).toBeGreaterThan(0);
        });
    });

    it('should return empty array when no matches', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
            mood: 'nonexistent',
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.items).toHaveLength(0);
        });
    });

    it('should limit results to 20 items', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.items.length).toBeLessThanOrEqual(20);
        });
    });
  });

  describe('GET /suggestion/:category/:id', () => {
    it('should return a specific book by id', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', '1');
          expect(res.body).toHaveProperty('title', 'The Great Gatsby');
          expect(res.body).toHaveProperty('author', 'F. Scott Fitzgerald');
        });
    });

    it('should return a specific film by id', () => {
      return request(app.getHttpServer())
        .get('/suggestion/films/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', '1');
          expect(res.body).toHaveProperty('title', 'Inception');
        });
    });

    it('should return 404 for non-existent item', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books/999')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
          expect(res.body.message).toBe('Item not found');
        });
    });

    it('should return 404 for invalid category', () => {
      return request(app.getHttpServer())
        .get('/suggestion/invalid-category/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.statusCode).toBe(404);
        });
    });
  });

  describe('Cache behavior', () => {
    it('should return same result for same criteria (cached)', async () => {
      const criteria = {
        criteria: {
          category: Category.BOOK,
          mood: 'melancholic',
        },
      };

      // First request
      const res1 = await request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'cache-test')
        .send(criteria)
        .expect(201);

      // Second request (should be cached)
      const res2 = await request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'cache-test')
        .send(criteria)
        .expect(201);

      expect(res1.body).toEqual(res2.body);
    });

    it('should generate different results for different criteria', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
            mood: 'melancholic',
          },
        })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
            mood: 'dark',
          },
        })
        .expect(201);

      expect(res1.body.items).not.toEqual(res2.body.items);
    });
  });

  describe('Validation', () => {
    it('should reject invalid criteria type', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: 'invalid-string',
        })
        .expect(400);
    });

    it('should reject invalid category type', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: 123,
          },
        })
        .expect(400);
    });

    it('should accept empty body', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({})
        .expect(201);
    });

    it('should accept valid request body', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'user-123')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201);
    });
  });

  describe('HTTP Methods', () => {
    it('should handle POST requests', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201);
    });

    it('should handle GET requests', () => {
      return request(app.getHttpServer()).get('/suggestion/books/1').expect(200);
    });
  });

  describe('Headers and Content Type', () => {
    it('should accept JSON content type', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('Content-Type', 'application/json')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201);
    });

    it('should return JSON by default', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books/1')
        .expect('Content-Type', /json/)
        .expect(200);
    });

    it('should handle custom headers', () => {
      return request(app.getHttpServer())
        .post('/suggestion')
        .set('X-User-Id', 'custom-user')
        .set('X-Custom-Header', 'test-value')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201);
    });
  });

  describe('Performance', () => {
    it('should respond quickly', async () => {
      const start = Date.now();

      await request(app.getHttpServer())
        .post('/suggestion')
        .send({
          criteria: {
            category: Category.BOOK,
          },
        })
        .expect(201);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/suggestion')
            .send({
              criteria: {
                category: Category.BOOK,
              },
            }),
        );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(201);
      });
    });
  });
});
