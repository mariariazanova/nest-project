import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { CreateFavoriteDto } from '../src/favorite/dto/create-favorite.dto';
import { FavoriteCategory } from '../src/favorite/entities/favorite.entity';

// Mock Test Controller (simulates the actual controller without dependencies)
@Controller('favorite')
class TestFavoriteController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private favorites: Map<string, any[]> = new Map();
  private idCounter = 1;

  @Get()
  async getUserFavorites(
    @Headers('X-User-Id') userId: string,
    @Query('category') category?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    if (category) {
      if (!Object.values(FavoriteCategory).includes(category as FavoriteCategory)) {
        throw new BadRequestException(
          `Invalid category. Must be one of: ${Object.values(FavoriteCategory).join(', ')}`,
        );
      }
    }

    const userFavorites = this.favorites.get(userId) || [];

    if (category) {
      return userFavorites.filter((fav) => fav.category === category);
    }

    return userFavorites;
  }

  @Get('check/:category/:itemId')
  async checkFavorite(
    @Param('category') category: string,
    @Param('itemId') itemId: string,
    @Headers('X-User-Id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    if (!Object.values(FavoriteCategory).includes(category as FavoriteCategory)) {
      throw new BadRequestException(
        `Invalid category. Must be one of: ${Object.values(FavoriteCategory).join(', ')}`,
      );
    }

    const userFavorites = this.favorites.get(userId) || [];
    const isFavorite = userFavorites.some(
      (fav) => fav.itemId === itemId && fav.category === category,
    );

    return { isFavorite };
  }

  @Get(':id')
  async getFavoriteById(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const userFavorites = this.favorites.get(userId) || [];
    const favorite = userFavorites.find((fav) => fav.id === id);

    if (!favorite) {
      throw new NotFoundException(`Favorite with id ${id} not found`);
    }

    return favorite;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addFavorite(@Body() dto: CreateFavoriteDto, @Headers('X-User-Id') userId: string) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const userFavorites = this.favorites.get(userId) || [];

    // Check for duplicate
    const exists = userFavorites.some(
      (fav) => fav.itemId === dto.itemId && fav.category === dto.category,
    );

    if (exists) {
      throw new BadRequestException('This item is already in favorites');
    }

    const newFavorite = {
      id: String(this.idCounter++),
      userId,
      itemId: dto.itemId,
      category: dto.category,
      title: dto.title,
      createdAt: new Date().toISOString(),
    };

    userFavorites.push(newFavorite);
    this.favorites.set(userId, userFavorites);

    return newFavorite;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFavorite(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const userFavorites = this.favorites.get(userId) || [];
    const index = userFavorites.findIndex((fav) => fav.id === id);

    if (index === -1) {
      throw new NotFoundException(`Favorite with id ${id} not found`);
    }

    userFavorites.splice(index, 1);
    this.favorites.set(userId, userFavorites);
  }
}

describe('FavoriteController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestFavoriteController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /favorite', () => {
    it('should add a favorite book', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-123')
        .send({
          itemId: 'book-1',
          category: FavoriteCategory.BOOK,
          title: 'The Great Gatsby',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.itemId).toBe('book-1');
          expect(res.body.category).toBe(FavoriteCategory.BOOK);
          expect(res.body.title).toBe('The Great Gatsby');
        });
    });

    it('should add a favorite film', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-123')
        .send({
          itemId: 'film-1',
          category: FavoriteCategory.FILM,
          title: 'Inception',
        })
        .expect(201);
    });

    it('should reject duplicate favorites', async () => {
      await request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-456')
        .send({
          itemId: 'book-2',
          category: FavoriteCategory.BOOK,
          title: '1984',
        })
        .expect(201);

      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-456')
        .send({
          itemId: 'book-2',
          category: FavoriteCategory.BOOK,
          title: '1984',
        })
        .expect(400);
    });

    it('should require X-User-Id header', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .send({
          itemId: 'book-1',
          category: FavoriteCategory.BOOK,
        })
        .expect(400);
    });

    it('should require itemId field', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-123')
        .send({
          category: FavoriteCategory.BOOK,
        })
        .expect(400);
    });

    it('should require category field', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-123')
        .send({
          itemId: 'book-1',
        })
        .expect(400);
    });

    it('should reject invalid category', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-123')
        .send({
          itemId: 'book-1',
          category: 'invalid-category',
        })
        .expect(400);
    });
  });

  describe('GET /favorite', () => {
    beforeAll(async () => {
      // Add test favorites
      await request(app.getHttpServer()).post('/favorite').set('X-User-Id', 'user-789').send({
        itemId: 'book-10',
        category: FavoriteCategory.BOOK,
        title: 'Test Book',
      });

      await request(app.getHttpServer()).post('/favorite').set('X-User-Id', 'user-789').send({
        itemId: 'film-10',
        category: FavoriteCategory.FILM,
        title: 'Test Film',
      });

      await request(app.getHttpServer()).post('/favorite').set('X-User-Id', 'user-789').send({
        itemId: 'game-10',
        category: FavoriteCategory.GAME,
        title: 'Test Game',
      });
    });

    it('should return all user favorites', () => {
      return request(app.getHttpServer())
        .get('/favorite')
        .set('X-User-Id', 'user-789')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(3);
        });
    });

    it('should filter favorites by category', () => {
      return request(app.getHttpServer())
        .get('/favorite?category=books')
        .set('X-User-Id', 'user-789')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.body.forEach((fav: any) => {
            expect(fav.category).toBe(FavoriteCategory.BOOK);
          });
        });
    });

    it('should return empty array for user with no favorites', () => {
      return request(app.getHttpServer())
        .get('/favorite')
        .set('X-User-Id', 'user-no-favorites')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual([]);
        });
    });

    it('should reject invalid category in query', () => {
      return request(app.getHttpServer())
        .get('/favorite?category=invalid')
        .set('X-User-Id', 'user-789')
        .expect(400);
    });

    it('should require X-User-Id header', () => {
      return request(app.getHttpServer()).get('/favorite').expect(400);
    });
  });

  describe('GET /favorite/:id', () => {
    let favoriteId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-get-test')
        .send({
          itemId: 'book-20',
          category: FavoriteCategory.BOOK,
          title: 'Get Test Book',
        });

      favoriteId = response.body.id;
    });

    it('should return a specific favorite by id', () => {
      return request(app.getHttpServer())
        .get(`/favorite/${favoriteId}`)
        .set('X-User-Id', 'user-get-test')
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(favoriteId);
          expect(res.body.itemId).toBe('book-20');
        });
    });

    it('should return 404 for non-existent favorite', () => {
      return request(app.getHttpServer())
        .get('/favorite/non-existent-id')
        .set('X-User-Id', 'user-get-test')
        .expect(404);
    });

    it('should require X-User-Id header', () => {
      return request(app.getHttpServer()).get(`/favorite/${favoriteId}`).expect(400);
    });
  });

  describe('DELETE /favorite/:id', () => {
    let favoriteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-delete-test')
        .send({
          itemId: 'book-30',
          category: FavoriteCategory.BOOK,
          title: 'Delete Test Book',
        });

      favoriteId = response.body.id;
    });

    it('should delete a favorite', async () => {
      await request(app.getHttpServer())
        .delete(`/favorite/${favoriteId}`)
        .set('X-User-Id', 'user-delete-test')
        .expect(204);

      // Verify it's deleted
      return request(app.getHttpServer())
        .get(`/favorite/${favoriteId}`)
        .set('X-User-Id', 'user-delete-test')
        .expect(404);
    });

    it('should return 404 when deleting non-existent favorite', () => {
      return request(app.getHttpServer())
        .delete('/favorite/non-existent-id')
        .set('X-User-Id', 'user-delete-test')
        .expect(404);
    });

    it('should require X-User-Id header', () => {
      return request(app.getHttpServer()).delete(`/favorite/${favoriteId}`).expect(400);
    });
  });

  describe('GET /favorite/check/:category/:itemId', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-check-test')
        .send({
          itemId: 'book-40',
          category: FavoriteCategory.BOOK,
          title: 'Check Test Book',
        });
    });

    it('should return true for favorited item', () => {
      return request(app.getHttpServer())
        .get('/favorite/check/books/book-40')
        .set('X-User-Id', 'user-check-test')
        .expect(200)
        .expect((res) => {
          expect(res.body.isFavorite).toBe(true);
        });
    });

    it('should return false for non-favorited item', () => {
      return request(app.getHttpServer())
        .get('/favorite/check/books/book-999')
        .set('X-User-Id', 'user-check-test')
        .expect(200)
        .expect((res) => {
          expect(res.body.isFavorite).toBe(false);
        });
    });

    it('should reject invalid category', () => {
      return request(app.getHttpServer())
        .get('/favorite/check/invalid/book-40')
        .set('X-User-Id', 'user-check-test')
        .expect(400);
    });

    it('should require X-User-Id header', () => {
      return request(app.getHttpServer()).get('/favorite/check/books/book-40').expect(400);
    });
  });

  describe('Validation', () => {
    it('should accept title as optional field', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-validation')
        .send({
          itemId: 'book-50',
          category: FavoriteCategory.BOOK,
        })
        .expect(201);
    });

    it('should reject invalid category enum values', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-validation')
        .send({
          itemId: 'book-51',
          category: 'invalid-enum',
        })
        .expect(400);
    });

    it('should reject empty itemId', () => {
      return request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-validation')
        .send({
          itemId: '',
          category: FavoriteCategory.BOOK,
        })
        .expect(400);
    });
  });

  describe('Multiple Users', () => {
    it('should isolate favorites between different users', async () => {
      // User 1 adds a favorite
      await request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-1')
        .send({
          itemId: 'book-60',
          category: FavoriteCategory.BOOK,
          title: 'User 1 Book',
        })
        .expect(201);

      // User 2 adds a favorite
      await request(app.getHttpServer())
        .post('/favorite')
        .set('X-User-Id', 'user-2')
        .send({
          itemId: 'book-61',
          category: FavoriteCategory.BOOK,
          title: 'User 2 Book',
        })
        .expect(201);

      // User 1's favorites
      const user1Favorites = await request(app.getHttpServer())
        .get('/favorite')
        .set('X-User-Id', 'user-1')
        .expect(200);

      // User 2's favorites
      const user2Favorites = await request(app.getHttpServer())
        .get('/favorite')
        .set('X-User-Id', 'user-2')
        .expect(200);

      // Verify isolation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(user1Favorites.body.some((fav: any) => fav.itemId === 'book-60')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(user1Favorites.body.some((fav: any) => fav.itemId === 'book-61')).toBe(false);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(user2Favorites.body.some((fav: any) => fav.itemId === 'book-61')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(user2Favorites.body.some((fav: any) => fav.itemId === 'book-60')).toBe(false);
    });
  });
});
