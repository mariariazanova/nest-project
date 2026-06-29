import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SuggestionController } from './suggestion.controller';
import { SuggestionService } from './suggestion.service';
import { FilterItemsDto } from './dto/filter-items.dto';

describe('SuggestionController', () => {
  let controller: SuggestionController;

  const mockSuggestionService = {
    findManyByProperty: jest.fn(),
    findOne: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuggestionController],
      providers: [
        {
          provide: SuggestionService,
          useValue: mockSuggestionService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    controller = module.get(SuggestionController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findFiltered', () => {
    const mockDto: FilterItemsDto = {
      criteria: {
        category: 'movie',
        mood: 'happy',
        genre: 'comedy',
        event: 'party',
      },
    };
    const mockUserId = 'user-123';
    const mockResult = [
      { id: '1', title: 'Movie 1' },
      { id: '2', title: 'Movie 2' },
    ];

    it('should return cached result when cache hit', async () => {
      mockCacheManager.get.mockResolvedValue(mockResult);

      const result = await controller.findFiltered('movie', 'happy', 'comedy', 'party', mockUserId);

      expect(result).toEqual(mockResult);
      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestions:movie:happy:comedy:party');
      expect(mockSuggestionService.findManyByProperty).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should fetch from service and cache when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockSuggestionService.findManyByProperty.mockResolvedValue(mockResult);

      const result = await controller.findFiltered('movie', 'happy', 'comedy', 'party', mockUserId);

      expect(result).toEqual(mockResult);
      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestions:movie:happy:comedy:party');
      expect(mockSuggestionService.findManyByProperty).toHaveBeenCalledWith(mockDto, mockUserId);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'suggestions:movie:happy:comedy:party',
        mockResult,
        1800000,
      );
    });

    it('should generate correct cache key with partial criteria', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockSuggestionService.findManyByProperty.mockResolvedValue(mockResult);

      await controller.findFiltered('book', undefined, 'fiction', undefined, mockUserId);

      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestions:book:any:fiction:any');
    });

    it('should generate correct cache key with no criteria', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockSuggestionService.findManyByProperty.mockResolvedValue(mockResult);

      await controller.findFiltered(undefined, undefined, undefined, undefined, mockUserId);

      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestions:all:any:any:any');
    });
  });

  describe('findOne', () => {
    const mockCategory = 'movie';
    const mockId = '123';
    const mockResult = { id: '123', title: 'Test Movie' };

    it('should return cached result when cache hit', async () => {
      mockCacheManager.get.mockResolvedValue(mockResult);

      const result = await controller.findOne(mockCategory, mockId);

      expect(result).toEqual(mockResult);
      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestion:movie:123');
      expect(mockSuggestionService.findOne).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should fetch from service and cache when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockSuggestionService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne(mockCategory, mockId);

      expect(result).toEqual(mockResult);
      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestion:movie:123');
      expect(mockSuggestionService.findOne).toHaveBeenCalledWith(mockCategory, mockId);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'suggestion:movie:123',
        mockResult,
        3600000,
      );
    });

    it('should handle different categories', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockSuggestionService.findOne.mockResolvedValue(mockResult);

      await controller.findOne('book', '456');

      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestion:book:456');
      expect(mockSuggestionService.findOne).toHaveBeenCalledWith('book', '456');
    });
  });

  describe('generateCacheKey (private method test via findFiltered)', () => {
    it('should handle null/undefined values correctly', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockSuggestionService.findManyByProperty.mockResolvedValue([]);

      await controller.findFiltered(null, undefined, '', null, 'user-123');

      // Empty string should be treated as falsy
      expect(mockCacheManager.get).toHaveBeenCalledWith('suggestions:all:any:any:any');
    });
  });
});
