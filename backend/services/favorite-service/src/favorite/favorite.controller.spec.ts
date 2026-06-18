import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';
import { FavoriteCategory, FavoriteEntity } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

describe('FavoriteController', () => {
  let controller: FavoriteController;
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

  const mockFavoriteService = {
    getUserFavorites: jest.fn(),
    getFavoriteById: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
    isFavorite: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoriteController],
      providers: [
        {
          provide: FavoriteService,
          useValue: mockFavoriteService,
        },
      ],
    }).compile();

    controller = module.get<FavoriteController>(FavoriteController);
    service = module.get<FavoriteService>(FavoriteService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserFavorites', () => {
    it('should return all user favorites without category filter', async () => {
      const favorites = [mockFavorite];
      mockFavoriteService.getUserFavorites.mockResolvedValue(favorites);

      const result = await controller.getUserFavorites(mockUserId, undefined);

      expect(result).toEqual(favorites);
      expect(service.getUserFavorites).toHaveBeenCalledWith(mockUserId, undefined);
    });

    it('should return filtered favorites by category', async () => {
      const favorites = [mockFavorite];
      mockFavoriteService.getUserFavorites.mockResolvedValue(favorites);

      const result = await controller.getUserFavorites(mockUserId, 'books');

      expect(result).toEqual(favorites);
      expect(service.getUserFavorites).toHaveBeenCalledWith(mockUserId, FavoriteCategory.BOOK);
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.getUserFavorites('', undefined)).rejects.toThrow(BadRequestException);

      expect(service.getUserFavorites).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid category', async () => {
      await expect(controller.getUserFavorites(mockUserId, 'invalid-category')).rejects.toThrow(
        BadRequestException,
      );

      expect(service.getUserFavorites).not.toHaveBeenCalled();
    });
  });

  describe('getFavoriteById', () => {
    it('should return a specific favorite by id', async () => {
      mockFavoriteService.getFavoriteById.mockResolvedValue(mockFavorite);

      const result = await controller.getFavoriteById('fav-1', mockUserId);

      expect(result).toEqual(mockFavorite);
      expect(service.getFavoriteById).toHaveBeenCalledWith(mockUserId, 'fav-1');
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.getFavoriteById('fav-1', '')).rejects.toThrow(BadRequestException);

      expect(service.getFavoriteById).not.toHaveBeenCalled();
    });
  });

  describe('addFavorite', () => {
    const createDto: CreateFavoriteDto = {
      itemId: 'item-1',
      category: FavoriteCategory.BOOK,
      title: 'Test Book',
    };

    it('should add a new favorite', async () => {
      mockFavoriteService.addFavorite.mockResolvedValue(mockFavorite);

      const result = await controller.addFavorite(createDto, mockUserId);

      expect(result).toEqual(mockFavorite);
      expect(service.addFavorite).toHaveBeenCalledWith(mockUserId, createDto);
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.addFavorite(createDto, '')).rejects.toThrow(BadRequestException);

      expect(service.addFavorite).not.toHaveBeenCalled();
    });
  });

  describe('removeFavorite', () => {
    it('should remove a favorite', async () => {
      mockFavoriteService.removeFavorite.mockResolvedValue(undefined);

      await controller.removeFavorite('fav-1', mockUserId);

      expect(service.removeFavorite).toHaveBeenCalledWith(mockUserId, 'fav-1');
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.removeFavorite('fav-1', '')).rejects.toThrow(BadRequestException);

      expect(service.removeFavorite).not.toHaveBeenCalled();
    });
  });

  describe('checkFavorite', () => {
    it('should return true if item is favorite', async () => {
      mockFavoriteService.isFavorite.mockResolvedValue(true);

      const result = await controller.checkFavorite('books', 'item-1', mockUserId);

      expect(result).toEqual({ isFavorite: true });
      expect(service.isFavorite).toHaveBeenCalledWith(mockUserId, 'item-1', FavoriteCategory.BOOK);
    });

    it('should return false if item is not favorite', async () => {
      mockFavoriteService.isFavorite.mockResolvedValue(false);

      const result = await controller.checkFavorite('books', 'item-1', mockUserId);

      expect(result).toEqual({ isFavorite: false });
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.checkFavorite('books', 'item-1', '')).rejects.toThrow(
        BadRequestException,
      );

      expect(service.isFavorite).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid category', async () => {
      await expect(
        controller.checkFavorite('invalid-category', 'item-1', mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(service.isFavorite).not.toHaveBeenCalled();
    });
  });
});
