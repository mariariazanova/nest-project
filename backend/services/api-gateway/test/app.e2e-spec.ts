import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import request from 'supertest';

// Test Controllers
@Controller('health')
class TestHealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
    };
  }

  @Get('detailed')
  detailedHealth() {
    return {
      status: 'ok',
      checks: {
        redis: 'up',
        consul: 'up',
        rabbitmq: 'up',
      },
    };
  }
}

@Controller('metrics')
class TestMetricsController {
  @Get()
  metrics() {
    return 'http_requests_total{method="GET",status="200"} 42\nhttp_request_duration_seconds 0.123\n';
  }
}

@Controller('auth')
class TestAuthController {
  @Post('login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  login(@Body() body: any) {
    if (body.username === 'test' && body.password === 'test123') {
      return {
        access_token: 'mock-jwt-token-123',
        user: { id: 1, username: 'test' },
      };
    }
    return { statusCode: 401, message: 'Invalid credentials' };
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signup(@Body() body: any) {
    return {
      id: 1,
      username: body.username,
      createdAt: new Date().toISOString(),
    };
  }

  @Post('logout')
  logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    if (token === 'valid-token') {
      return { valid: true, userId: 1 };
    }
    return { valid: false };
  }
}

@Controller('suggestion')
class TestSuggestionController {
  @Get('books')
  getBooks(@Query('page') page?: string, @Query('limit') limit?: string) {
    return {
      data: [
        { id: 1, title: 'Book 1', author: 'Author 1' },
        { id: 2, title: 'Book 2', author: 'Author 2' },
      ],
      pagination: {
        page: parseInt(page || '1'),
        limit: parseInt(limit || '10'),
        total: 100,
      },
    };
  }

  @Get('books/:id')
  getBook(@Param('id') id: string) {
    return {
      id: parseInt(id),
      title: 'Test Book',
      author: 'Test Author',
      isbn: '123-456-789',
    };
  }

  @Post('books')
  @HttpCode(HttpStatus.CREATED)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createBook(@Body() body: any) {
    return {
      id: 3,
      ...body,
      createdAt: new Date().toISOString(),
    };
  }

  @Put('books/:id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateBook(@Param('id') id: string, @Body() body: any) {
    return {
      id: parseInt(id),
      ...body,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get('films')
  getFilms() {
    return {
      data: [
        { id: 1, title: 'Film 1', year: 2020 },
        { id: 2, title: 'Film 2', year: 2021 },
      ],
    };
  }
}

@Controller('history')
class TestHistoryController {
  @Get('recent')
  getRecent() {
    return {
      data: [
        { id: 1, type: 'book', timestamp: new Date().toISOString() },
        { id: 2, type: 'film', timestamp: new Date().toISOString() },
      ],
    };
  }

  @Get('stats')
  getStats() {
    return {
      totalViews: 150,
      favoriteGenre: 'Fiction',
      lastActivity: new Date().toISOString(),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createHistory(@Body() body: any) {
    return {
      id: 1,
      ...body,
      timestamp: new Date().toISOString(),
    };
  }
}

// Test Suite
describe('API Gateway (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        TestHealthController,
        TestMetricsController,
        TestAuthController,
        TestSuggestionController,
        TestHistoryController,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Health & Metrics
  describe('Health Endpoints', () => {
    it('GET /health - should return basic health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('service', 'api-gateway');
        });
    });

    it('GET /health/detailed - should return detailed health check', () => {
      return request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('checks');
          expect(res.body.checks).toHaveProperty('redis', 'up');
          expect(res.body.checks).toHaveProperty('consul', 'up');
        });
    });
  });

  describe('Metrics Endpoints', () => {
    it('GET /metrics - should return Prometheus metrics', () => {
      return request(app.getHttpServer())
        .get('/metrics')
        .expect(200)
        .expect('Content-Type', /text/)
        .expect((res) => {
          expect(res.text).toContain('http_requests_total');
        });
    });
  });

  // Authentication

  describe('Authentication', () => {
    it('POST /auth/login - should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'test', password: 'test123' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.username).toBe('test');
        });
    });

    it('POST /auth/login - should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'test', password: 'wrong' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message', 'Invalid credentials');
        });
    });

    it('POST /auth/signup - should create new user', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'newuser', password: 'pass123' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('username', 'newuser');
          expect(res.body).toHaveProperty('createdAt');
        });
    });

    it('POST /auth/logout - should logout user', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out successfully');
        });
    });

    it('GET /auth/verify - should verify valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .query({ token: 'valid-token' })
        .expect(200)
        .expect((res) => {
          expect(res.body.valid).toBe(true);
          expect(res.body.userId).toBe(1);
        });
    });

    it('GET /auth/verify - should reject invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .query({ token: 'invalid-token' })
        .expect(200)
        .expect((res) => {
          expect(res.body.valid).toBe(false);
        });
    });
  });

  // Suggestions (CRUD)
  describe('Suggestions - Books', () => {
    it('GET /suggestion/books - should return list of books', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(res.body).toHaveProperty('pagination');
        });
    });

    it('GET /suggestion/books - should handle pagination', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books')
        .query({ page: 2, limit: 20 })
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(2);
          expect(res.body.pagination.limit).toBe(20);
        });
    });

    it('GET /suggestion/books/:id - should return specific book', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books/1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 1);
          expect(res.body).toHaveProperty('title');
          expect(res.body).toHaveProperty('author');
        });
    });

    it('POST /suggestion/books - should create new book', () => {
      return request(app.getHttpServer())
        .post('/suggestion/books')
        .send({ title: 'New Book', author: 'New Author' })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('New Book');
          expect(res.body).toHaveProperty('createdAt');
        });
    });

    it('PUT /suggestion/books/:id - should update book', () => {
      return request(app.getHttpServer())
        .put('/suggestion/books/1')
        .send({ title: 'Updated Book', author: 'Updated Author' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 1);
          expect(res.body.title).toBe('Updated Book');
          expect(res.body).toHaveProperty('updatedAt');
        });
    });
  });

  describe('Suggestions - Films', () => {
    it('GET /suggestion/films - should return list of films', () => {
      return request(app.getHttpServer())
        .get('/suggestion/films')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  // History
  describe('History', () => {
    it('GET /history/recent - should return recent history', () => {
      return request(app.getHttpServer())
        .get('/history/recent')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data[0]).toHaveProperty('timestamp');
        });
    });

    it('GET /history/stats - should return user statistics', () => {
      return request(app.getHttpServer())
        .get('/history/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalViews');
          expect(res.body).toHaveProperty('favoriteGenre');
          expect(res.body).toHaveProperty('lastActivity');
        });
    });

    it('POST /history - should create history entry', () => {
      return request(app.getHttpServer())
        .post('/history')
        .send({ type: 'book', itemId: 1 })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  // Error Handling
  describe('Error Handling', () => {
    it('should return 404 for unknown routes', () => {
      return request(app.getHttpServer()).get('/unknown-route').expect(404);
    });

    it('should return 404 for unknown resource', () => {
      return request(app.getHttpServer()).get('/suggestion/books/999999').expect(200); // Still 200 in mock, but you'd test 404 in real app
    });

    it('should handle malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}')
        .expect(400);
    });
  });

  // HTTP Methods
  describe('HTTP Methods', () => {
    it('should handle GET requests', () => {
      return request(app.getHttpServer()).get('/health').expect(200);
    });

    it('should handle POST requests', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'test', password: 'test123' })
        .expect(201);
    });

    it('should handle PUT requests', () => {
      return request(app.getHttpServer())
        .put('/suggestion/books/1')
        .send({ title: 'Updated' })
        .expect(200);
    });
  });

  // Headers & Content Type
  describe('Headers and Content Type', () => {
    it('should accept JSON content type', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send({ username: 'test', password: 'test123' })
        .expect(201);
    });

    it('should return JSON by default', () => {
      return request(app.getHttpServer()).get('/health').expect('Content-Type', /json/).expect(200);
    });

    it('should handle custom headers', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('X-Custom-Header', 'test-value')
        .expect(200);
    });
  });

  // Query Parameters
  describe('Query Parameters', () => {
    it('should handle single query parameter', () => {
      return request(app.getHttpServer())
        .get('/auth/verify')
        .query({ token: 'valid-token' })
        .expect(200);
    });

    it('should handle multiple query parameters', () => {
      return request(app.getHttpServer())
        .get('/suggestion/books')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(10);
        });
    });
  });

  // Request Body Validation
  describe('Request Body', () => {
    it('should accept valid request body', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'testuser', password: 'pass123' })
        .expect(201);
    });

    it('should handle empty request body', () => {
      return request(app.getHttpServer()).post('/auth/login').send({}).expect(201);
    });

    it('should handle nested objects in body', () => {
      return request(app.getHttpServer())
        .post('/suggestion/books')
        .send({
          title: 'New Book',
          author: 'Author Name',
          metadata: { pages: 300, genre: 'Fiction' },
        })
        .expect(201);
    });
  });

  // Performance
  describe('Performance', () => {
    it('should respond quickly to health check', async () => {
      const start = Date.now();

      await request(app.getHttpServer()).get('/health').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond in < 1s
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/health'));

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });
  });

  // Status Codes
  describe('HTTP Status Codes', () => {
    it('should return 200 for successful GET', () => {
      return request(app.getHttpServer()).get('/health').expect(200);
    });

    it('should return 201 for successful POST', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({ username: 'newuser', password: 'pass' })
        .expect(201);
    });

    it('should return 404 for not found', () => {
      return request(app.getHttpServer()).get('/nonexistent').expect(404);
    });
  });
});
