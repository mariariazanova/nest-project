import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserActivityProducerService } from '@suggestify/backend/kafka';
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

  const mockRabbitMQClient = {
    emit: jest.fn(),
  };

  const mockNotificationClient = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoriteController],
      providers: [
        {
          provide: FavoriteService,
          useValue: mockFavoriteService,
        },
        {
          provide: 'RABBITMQ_CLIENT',
          useValue: mockRabbitMQClient,
        },
        {
          provide: 'NOTIFICATION_CLIENT',
          useValue: mockNotificationClient,
        },
        {
          provide: UserActivityProducerService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    controller = module.get(FavoriteController);
    service = module.get(FavoriteService);

    jest.clearAllMocks();
    mockRabbitMQClient.emit.mockReturnValue({ subscribe: jest.fn() });
    mockNotificationClient.emit.mockReturnValue({ subscribe: jest.fn() });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserFavorites', () => {
    it('should return all user favorites without category filter', async () => {
      const favorites = [mockFavorite];
      mockFavoriteService.getUserFavorites.mockResolvedValue(favorites);

      const result = await controller.getAll(mockUserId, undefined);

      expect(result.body).toEqual(favorites);
      expect(service.getUserFavorites).toHaveBeenCalledWith(
        mockUserId,
        undefined,
      );
    });

    it('should return filtered favorites by category', async () => {
      const favorites = [mockFavorite];
      mockFavoriteService.getUserFavorites.mockResolvedValue(favorites);

      const result = await controller.getAll(mockUserId, 'books');

      expect(result.body).toEqual(favorites);
      expect(service.getUserFavorites).toHaveBeenCalledWith(
        mockUserId,
        FavoriteCategory.BOOK,
      );
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.getAll('', undefined)).rejects.toThrow(
        BadRequestException,
      );

      expect(service.getUserFavorites).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid category', async () => {
      await expect(
        controller.getAll(mockUserId, 'invalid-category'),
      ).rejects.toThrow(BadRequestException);

      expect(service.getUserFavorites).not.toHaveBeenCalled();
    });
  });

  describe('getFavoriteById', () => {
    it('should return a specific favorite by id', async () => {
      mockFavoriteService.getFavoriteById.mockResolvedValue(mockFavorite);

      const result = await controller.getById('fav-1', mockUserId);

      expect(result.body).toEqual(mockFavorite);
      expect(service.getFavoriteById).toHaveBeenCalledWith(mockUserId, 'fav-1');
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.getById('fav-1', '')).rejects.toThrow(
        BadRequestException,
      );

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

      const result = await controller.add(createDto, mockUserId);

      expect(result.body).toEqual(mockFavorite);
      expect(service.addFavorite).toHaveBeenCalledWith(mockUserId, createDto);
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.add(createDto, '')).rejects.toThrow(
        BadRequestException,
      );

      expect(service.addFavorite).not.toHaveBeenCalled();
    });
  });

  describe('removeFavorite', () => {
    it('should remove a favorite and emit favorite.deleted event', async () => {
      mockFavoriteService.removeFavorite.mockResolvedValue(mockFavorite);

      await controller.remove('fav-1', mockUserId);

      expect(service.removeFavorite).toHaveBeenCalledWith(mockUserId, 'fav-1');
      expect(mockRabbitMQClient.emit).toHaveBeenCalledWith('favorite.deleted', {
        favoriteId: 'fav-1',
      });
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.remove('fav-1', '')).rejects.toThrow(
        BadRequestException,
      );

      expect(service.removeFavorite).not.toHaveBeenCalled();
    });
  });

  describe('checkFavorite', () => {
    it('should return true if item is favorite', async () => {
      mockFavoriteService.isFavorite.mockResolvedValue(true);

      const result = await controller.checkFavorite(
        'books',
        'item-1',
        mockUserId,
      );

      expect(result.body).toEqual({ isFavorite: true });
      expect(service.isFavorite).toHaveBeenCalledWith(
        mockUserId,
        'item-1',
        FavoriteCategory.BOOK,
      );
    });

    it('should return false if item is not favorite', async () => {
      mockFavoriteService.isFavorite.mockResolvedValue(false);

      const result = await controller.checkFavorite(
        'books',
        'item-1',
        mockUserId,
      );

      expect(result.body).toEqual({ isFavorite: false });
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(
        controller.checkFavorite('books', 'item-1', ''),
      ).rejects.toThrow(BadRequestException);

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
