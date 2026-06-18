import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { FavoriteEntity, FavoriteCategory } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

describe('FavoriteService', () => {
  let service: FavoriteService;

  const mockUserId = 'user-123';
  const mockFavorite: FavoriteEntity = {
    id: 'fav-1',
    userId: mockUserId,
    itemId: 'item-1',
    category: FavoriteCategory.BOOK,
    title: 'Test Book',
    createdAt: new Date(),
  };

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoriteService,
        {
          provide: getRepositoryToken(FavoriteEntity),
          useValue: mockRepository,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get(FavoriteService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserFavorites', () => {
    it('should return cached favorites if available', async () => {
      const cachedFavorites = [mockFavorite];
      mockCacheManager.get.mockResolvedValue(cachedFavorites);

      const result = await service.getUserFavorites(mockUserId);

      expect(result).toEqual(cachedFavorites);
      expect(mockCacheManager.get).toHaveBeenCalledWith('favorites:user:user-123:all');
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('should fetch favorites from database if not cached', async () => {
      const favorites = [mockFavorite];
      mockCacheManager.get.mockResolvedValue(null);
      mockRepository.find.mockResolvedValue(favorites);

      const result = await service.getUserFavorites(mockUserId);

      expect(result).toEqual(favorites);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'favorites:user:user-123:all',
        favorites,
        300000,
      );
    });

    it('should filter by category when provided', async () => {
      const favorites = [mockFavorite];
      mockCacheManager.get.mockResolvedValue(null);
      mockRepository.find.mockResolvedValue(favorites);

      const result = await service.getUserFavorites(mockUserId, FavoriteCategory.BOOK);

      expect(result).toEqual(favorites);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId, category: FavoriteCategory.BOOK },
        order: { createdAt: 'DESC' },
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'favorites:user:user-123:books',
        favorites,
        300000,
      );
    });
  });

  describe('addFavorite', () => {
    const createDto: CreateFavoriteDto = {
      itemId: 'item-1',
      category: FavoriteCategory.BOOK,
      title: 'Test Book',
    };

    it('should create a new favorite', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockFavorite);
      mockRepository.save.mockResolvedValue(mockFavorite);
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.addFavorite(mockUserId, createDto);

      expect(result).toEqual(mockFavorite);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          itemId: createDto.itemId,
          category: createDto.category,
        },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        itemId: createDto.itemId,
        category: createDto.category,
        title: createDto.title,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockFavorite);
    });

    it('should throw ConflictException if favorite already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockFavorite);

      await expect(service.addFavorite(mockUserId, createDto)).rejects.toThrow(ConflictException);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should invalidate user cache after adding favorite', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockFavorite);
      mockRepository.save.mockResolvedValue(mockFavorite);
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.addFavorite(mockUserId, createDto);

      const expectedCacheKeys = [
        'favorites:user:user-123:all',
        'favorites:user:user-123:books',
        'favorites:user:user-123:films',
        'favorites:user:user-123:games',
        'favorites:user:user-123:songs',
      ];

      expect(mockCacheManager.del).toHaveBeenCalledTimes(expectedCacheKeys.length);
    });
  });

  describe('removeFavorite', () => {
    const favoriteId = 'fav-1';

    it('should remove a favorite successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockFavorite);
      mockRepository.delete.mockResolvedValue({ affected: 1 });
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.removeFavorite(mockUserId, favoriteId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: favoriteId },
      });
      expect(mockRepository.delete).toHaveBeenCalledWith(favoriteId);
    });

    it('should throw NotFoundException if favorite not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.removeFavorite(mockUserId, favoriteId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user does not own the favorite', async () => {
      const otherUserFavorite = { ...mockFavorite, userId: 'other-user' };
      mockRepository.findOne.mockResolvedValue(otherUserFavorite);

      await expect(service.removeFavorite(mockUserId, favoriteId)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should invalidate user cache after removing favorite', async () => {
      mockRepository.findOne.mockResolvedValue(mockFavorite);
      mockRepository.delete.mockResolvedValue({ affected: 1 });
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.removeFavorite(mockUserId, favoriteId);

      const expectedCacheKeys = [
        'favorites:user:user-123:all',
        'favorites:user:user-123:books',
        'favorites:user:user-123:films',
        'favorites:user:user-123:games',
        'favorites:user:user-123:songs',
      ];

      expect(mockCacheManager.del).toHaveBeenCalledTimes(expectedCacheKeys.length);
    });
  });

  describe('getFavoriteById', () => {
    const favoriteId = 'fav-1';

    it('should return favorite if found and owned by user', async () => {
      mockRepository.findOne.mockResolvedValue(mockFavorite);

      const result = await service.getFavoriteById(mockUserId, favoriteId);

      expect(result).toEqual(mockFavorite);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: favoriteId },
      });
    });

    it('should throw NotFoundException if favorite not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getFavoriteById(mockUserId, favoriteId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the favorite', async () => {
      const otherUserFavorite = { ...mockFavorite, userId: 'other-user' };
      mockRepository.findOne.mockResolvedValue(otherUserFavorite);

      await expect(service.getFavoriteById(mockUserId, favoriteId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('isFavorite', () => {
    it('should return true if favorite exists', async () => {
      mockRepository.count.mockResolvedValue(1);

      const result = await service.isFavorite(mockUserId, 'item-1', FavoriteCategory.BOOK);

      expect(result).toBe(true);
      expect(mockRepository.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          itemId: 'item-1',
          category: FavoriteCategory.BOOK,
        },
      });
    });

    it('should return false if favorite does not exist', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await service.isFavorite(mockUserId, 'item-1', FavoriteCategory.BOOK);

      expect(result).toBe(false);
    });
  });
});
