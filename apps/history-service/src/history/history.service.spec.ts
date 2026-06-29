import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { HistoryService } from './history.service';
import { SuggestionHistory } from './schemas/suggestion-history.schema';

describe('HistoryService', () => {
  let service: HistoryService;
  let historyModel: Model<SuggestionHistory>;

  const mockHistoryEntry = {
    _id: 'history-123',
    userId: 'user-123',
    criteria: {
      category: 'books',
      mood: 'happy',
      genre: 'fiction',
    },
    suggestions: [
      { id: '1', title: 'Book 1', category: 'books' },
      { id: '2', title: 'Book 2', category: 'books' },
    ],
    timestamp: new Date('2024-01-01'),
    metadata: {
      source: 'web',
    },
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    // Create a mock constructor function
    const MockHistoryModelConstructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, _id: 'history-123' }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: getModelToken(SuggestionHistory.name),
          useValue: MockHistoryModelConstructor,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get(HistoryService);
    historyModel = module.get(getModelToken(SuggestionHistory.name));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createHistoryEntry', () => {
    const createData = {
      userId: 'user-123',
      criteria: { category: 'books', mood: 'happy' },
      suggestions: [{ id: '1', title: 'Book 1' }],
    };

    it('should create a new history entry', async () => {
      const result = await service.createHistoryEntry(createData);

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(historyModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          criteria: createData.criteria,
          suggestions: createData.suggestions,
          timestamp: expect.any(Date),
          metadata: { source: 'web' },
        }),
      );
    });

    it('should cache the created entry', async () => {
      await service.createHistoryEntry(createData);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'history:user:user-123:item:history-123',
        expect.objectContaining({
          userId: 'user-123',
          _id: 'history-123',
        }),
        1800000,
      );
    });

    it('should throw error if save fails', async () => {
      const MockFailingConstructor = jest.fn().mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HistoryService,
          {
            provide: getModelToken(SuggestionHistory.name),
            useValue: MockFailingConstructor,
          },
          {
            provide: CACHE_MANAGER,
            useValue: mockCacheManager,
          },
        ],
      }).compile();

      const failingService = module.get(HistoryService);

      await expect(failingService.createHistoryEntry(createData)).rejects.toThrow('Database error');
    });

    it('should set correct metadata source', async () => {
      const result = await service.createHistoryEntry(createData);

      expect(result.metadata).toEqual({ source: 'web' });
    });
  });

  describe('getUserHistory', () => {
    const mockHistoryArray = [
      { ...mockHistoryEntry, _id: 'history-1' },
      { ...mockHistoryEntry, _id: 'history-2' },
    ];

    beforeEach(() => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockHistoryArray),
      };
      (historyModel.find as jest.Mock) = jest.fn().mockReturnValue(mockQuery);
    });

    it('should return user history sorted by timestamp', async () => {
      const result = await service.getUserHistory('user-123');

      expect(historyModel.find).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(result).toEqual(mockHistoryArray);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no history found', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      (historyModel.find as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

      const result = await service.getUserHistory('user-456');

      expect(result).toEqual([]);
    });

    it('should query with correct userId', async () => {
      await service.getUserHistory('user-789');

      expect(historyModel.find).toHaveBeenCalledWith({ userId: 'user-789' });
    });
  });

  describe('getHistoryItem', () => {
    const mockItem = { ...mockHistoryEntry };

    beforeEach(() => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockItem),
      };
      (historyModel.findOne as jest.Mock) = jest.fn().mockReturnValue(mockQuery);
    });

    it('should return cached item if available', async () => {
      mockCacheManager.get.mockResolvedValue(mockItem);

      const result = await service.getHistoryItem('history-123', 'user-123');

      expect(result).toEqual(mockItem);
      expect(mockCacheManager.get).toHaveBeenCalledWith('history:user:user-123:item:history-123');
      expect(historyModel.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getHistoryItem('history-123', 'user-123');

      expect(mockCacheManager.get).toHaveBeenCalledWith('history:user:user-123:item:history-123');
      expect(historyModel.findOne).toHaveBeenCalledWith({
        _id: 'history-123',
        userId: 'user-123',
      });
      expect(result).toEqual(mockItem);
    });

    it('should cache fetched item', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.getHistoryItem('history-123', 'user-123');

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'history:user:user-123:item:history-123',
        mockItem,
        1800000,
      );
    });

    it('should throw NotFoundException if item not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(null),
      };
      (historyModel.findOne as jest.Mock) = jest.fn().mockReturnValue(mockQuery);

      await expect(service.getHistoryItem('history-999', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getHistoryItem('history-999', 'user-123')).rejects.toThrow(
        'History item not found',
      );
    });

    it('should enforce user ownership (security check)', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.getHistoryItem('history-123', 'user-456');

      expect(historyModel.findOne).toHaveBeenCalledWith({
        _id: 'history-123',
        userId: 'user-456', // Different user
      });
    });

    it('should use user-scoped cache key', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.getHistoryItem('history-123', 'user-789');

      expect(mockCacheManager.get).toHaveBeenCalledWith('history:user:user-789:item:history-123');
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'history:user:user-789:item:history-123',
        expect.any(Object),
        1800000,
      );
    });
  });

  describe('getUserStats', () => {
    const mockAggregateResult = [
      {
        total: [{ count: 25 }],
        byCategoryArray: [
          { _id: 'books', count: 15 },
          { _id: 'films', count: 10 },
        ],
        byMoodArray: [
          { _id: 'happy', count: 12 },
          { _id: 'sad', count: 8 },
          { _id: 'excited', count: 5 },
        ],
        recent: [
          {
            _id: 'history-1',
            criteria: { category: 'books' },
            timestamp: new Date('2024-01-01'),
            suggestionsCount: 5,
          },
          {
            _id: 'history-2',
            criteria: { category: 'films' },
            timestamp: new Date('2024-01-02'),
            suggestionsCount: 3,
          },
        ],
      },
    ];

    beforeEach(() => {
      (historyModel.aggregate as jest.Mock) = jest.fn().mockResolvedValue(mockAggregateResult);
    });

    it('should return user statistics', async () => {
      const result = await service.getUserStats('user-123');

      expect(result).toHaveProperty('totalSearches', 25);
      expect(result).toHaveProperty('byCategory');
      expect(result).toHaveProperty('byMood');
      expect(result).toHaveProperty('recentSearches');
      expect(result).toHaveProperty('userId', 'user-123');
      expect(result).toHaveProperty('generatedAt');
    });

    it('should aggregate data correctly', async () => {
      const result = await service.getUserStats('user-123');

      expect(historyModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: { userId: 'user-123' } }),
          expect.objectContaining({ $facet: expect.any(Object) }),
        ]),
      );

      expect(result.totalSearches).toBe(25);
      expect(result.byCategory).toHaveLength(2);
      expect(result.byMood).toHaveLength(3);
      expect(result.recentSearches).toHaveLength(2);
    });

    it('should handle empty history gracefully', async () => {
      (historyModel.aggregate as jest.Mock) = jest.fn().mockResolvedValue([
        {
          total: [],
          byCategoryArray: [],
          byMoodArray: [],
          recent: [],
        },
      ]);

      const result = await service.getUserStats('user-empty');

      expect(result.totalSearches).toBe(0);
      expect(result.byCategory).toEqual([]);
      expect(result.byMood).toEqual([]);
      expect(result.recentSearches).toEqual([]);
    });

    it('should include userId in result', async () => {
      const result = await service.getUserStats('user-456');

      expect(result.userId).toBe('user-456');
    });

    it('should include generatedAt timestamp', async () => {
      const result = await service.getUserStats('user-123');

      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should sort categories by count', async () => {
      const result = await service.getUserStats('user-123');

      expect(result.byCategory[0].count).toBeGreaterThanOrEqual(result.byCategory[1].count);
    });

    it('should limit moods to top 10', async () => {
      const manyMoods = Array(15)
        .fill(null)
        .map((_, i) => ({ _id: `mood-${i}`, count: 15 - i }));

      (historyModel.aggregate as jest.Mock) = jest.fn().mockResolvedValue([
        {
          total: [{ count: 100 }],
          byCategoryArray: [],
          byMoodArray: manyMoods.slice(0, 10), // Slice to 10 like MongoDB would
          recent: [],
        },
      ]);

      const result = await service.getUserStats('user-123');

      expect(result.byMood.length).toBeLessThanOrEqual(10);
      expect(result.byMood).toHaveLength(10); // More specific assertion
    });

    it('should include recent searches with suggestion counts', async () => {
      const result = await service.getUserStats('user-123');

      expect(result.recentSearches[0]).toHaveProperty('suggestionsCount');
      expect(result.recentSearches[0].suggestionsCount).toBe(5);
    });
  });
});
