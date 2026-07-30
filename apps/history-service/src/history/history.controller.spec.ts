import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { UserActivityProducerService } from '@suggestify/backend/kafka';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

describe('HistoryController', () => {
  let controller: HistoryController;
  let historyService: HistoryService;

  const mockHistoryService = {
    getUserHistory: jest.fn(),
    getUserStats: jest.fn(),
    getHistoryItem: jest.fn(),
    createHistoryEntry: jest.fn(),
  };

  const mockHistoryArray = [
    {
      _id: 'history-1',
      userId: 'user-123',
      criteria: { category: 'books', mood: 'happy' },
      suggestions: [{ id: '1', title: 'Book 1' }],
      timestamp: new Date('2024-01-01'),
    },
    {
      _id: 'history-2',
      userId: 'user-123',
      criteria: { category: 'films', mood: 'exciting' },
      suggestions: [{ id: '2', title: 'Film 1' }],
      timestamp: new Date('2024-01-02'),
    },
  ];

  const mockHistoryItem = {
    _id: 'history-123',
    userId: 'user-123',
    criteria: { category: 'books', mood: 'happy' },
    suggestions: [{ id: '1', title: 'Book 1' }],
    timestamp: new Date('2024-01-01'),
  };

  const mockStats = {
    totalSearches: 25,
    byCategory: [
      { _id: 'books', count: 15 },
      { _id: 'films', count: 10 },
    ],
    byMood: [
      { _id: 'happy', count: 12 },
      { _id: 'sad', count: 8 },
    ],
    recentSearches: [
      {
        _id: 'history-1',
        criteria: { category: 'books' },
        timestamp: new Date('2024-01-01'),
        suggestionsCount: 5,
      },
    ],
    userId: 'user-123',
    generatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [
        {
          provide: HistoryService,
          useValue: mockHistoryService,
        },
        {
          provide: ClsService,
          useValue: {
            run: jest.fn((fn: () => unknown) => fn()),
            set: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: UserActivityProducerService,
          useValue: { emit: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    controller = module.get(HistoryController);
    historyService = module.get(HistoryService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserHistory', () => {
    it('should return user history', async () => {
      mockHistoryService.getUserHistory.mockResolvedValue(mockHistoryArray);

      const result = await controller.getAll('user-123');

      expect(result.body).toEqual(mockHistoryArray);
      expect(historyService.getUserHistory).toHaveBeenCalledWith('user-123');
      expect(historyService.getUserHistory).toHaveBeenCalledTimes(1);
    });

    it('should return empty array if no history', async () => {
      mockHistoryService.getUserHistory.mockResolvedValue([]);

      const result = await controller.getAll('user-456');

      expect(result.body).toEqual([]);
      expect(historyService.getUserHistory).toHaveBeenCalledWith('user-456');
    });

    it('should pass userId from header to service', async () => {
      mockHistoryService.getUserHistory.mockResolvedValue(mockHistoryArray);

      await controller.getAll('user-789');

      expect(historyService.getUserHistory).toHaveBeenCalledWith('user-789');
    });

    it('should handle service errors', async () => {
      mockHistoryService.getUserHistory.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getAll('user-123')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      mockHistoryService.getUserStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('user-123');

      expect(result.body).toEqual(mockStats);
      expect(historyService.getUserStats).toHaveBeenCalledWith('user-123');
      expect(historyService.getUserStats).toHaveBeenCalledTimes(1);
    });

    it('should return stats with correct structure', async () => {
      mockHistoryService.getUserStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('user-123');

      expect(result.body).toHaveProperty('totalSearches');
      expect(result.body).toHaveProperty('byCategory');
      expect(result.body).toHaveProperty('byMood');
      expect(result.body).toHaveProperty('recentSearches');
      expect(result.body).toHaveProperty('userId');
      expect(result.body).toHaveProperty('generatedAt');
    });

    it('should pass userId from header to service', async () => {
      mockHistoryService.getUserStats.mockResolvedValue(mockStats);

      await controller.getStats('user-456');

      expect(historyService.getUserStats).toHaveBeenCalledWith('user-456');
    });

    it('should handle empty stats', async () => {
      const emptyStats = {
        totalSearches: 0,
        byCategory: [],
        byMood: [],
        recentSearches: [],
        userId: 'user-empty',
        generatedAt: new Date(),
      };
      mockHistoryService.getUserStats.mockResolvedValue(emptyStats);

      const result = await controller.getStats('user-empty');

      expect(result.body.totalSearches).toBe(0);
      expect(result.body.byCategory).toEqual([]);
    });

    it('should handle service errors', async () => {
      mockHistoryService.getUserStats.mockRejectedValue(
        new Error('Aggregation error'),
      );

      await expect(controller.getStats('user-123')).rejects.toThrow(
        'Aggregation error',
      );
    });
  });

  describe('getHistoryItem', () => {
    it('should return specific history item', async () => {
      mockHistoryService.getHistoryItem.mockResolvedValue(mockHistoryItem);

      const result = await controller.getById('history-123', 'user-123');

      expect(result.body).toEqual(mockHistoryItem);
      expect(historyService.getHistoryItem).toHaveBeenCalledWith(
        'history-123',
        'user-123',
      );
      expect(historyService.getHistoryItem).toHaveBeenCalledTimes(1);
    });

    it('should pass both id and userId to service', async () => {
      mockHistoryService.getHistoryItem.mockResolvedValue(mockHistoryItem);

      await controller.getById('history-456', 'user-789');

      expect(historyService.getHistoryItem).toHaveBeenCalledWith(
        'history-456',
        'user-789',
      );
    });

    it('should handle not found error', async () => {
      mockHistoryService.getHistoryItem.mockRejectedValue(
        new Error('History item not found'),
      );

      await expect(
        controller.getById('history-999', 'user-123'),
      ).rejects.toThrow('History item not found');
    });

    it('should enforce user ownership through service', async () => {
      mockHistoryService.getHistoryItem.mockResolvedValue(mockHistoryItem);

      await controller.getById('history-123', 'wrong-user');

      expect(historyService.getHistoryItem).toHaveBeenCalledWith(
        'history-123',
        'wrong-user',
      );
    });

    it('should handle service errors', async () => {
      mockHistoryService.getHistoryItem.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.getById('history-123', 'user-123'),
      ).rejects.toThrow('Database error');
    });
  });

  describe('handleSuggestionCreated', () => {
    const mockEventData = {
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
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    it('should handle suggestion_created event', async () => {
      mockHistoryService.createHistoryEntry.mockResolvedValue(mockHistoryItem);

      const result = await controller.handleSuggestionCreated(mockEventData);

      expect(result).toEqual(mockHistoryItem);
      expect(historyService.createHistoryEntry).toHaveBeenCalledWith(
        mockEventData,
      );
      expect(historyService.createHistoryEntry).toHaveBeenCalledTimes(1);
    });

    it('should pass complete event data to service', async () => {
      mockHistoryService.createHistoryEntry.mockResolvedValue(mockHistoryItem);

      await controller.handleSuggestionCreated(mockEventData);

      expect(historyService.createHistoryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          criteria: expect.any(Object),
          suggestions: expect.any(Array),
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle event with minimal data', async () => {
      const minimalData = {
        userId: 'user-123',
        criteria: { category: 'books' },
        suggestions: [],
      };
      mockHistoryService.createHistoryEntry.mockResolvedValue(mockHistoryItem);

      await controller.handleSuggestionCreated(minimalData);

      expect(historyService.createHistoryEntry).toHaveBeenCalledWith(
        minimalData,
      );
    });

    it('should handle event with multiple suggestions', async () => {
      const dataWithMany = {
        ...mockEventData,
        suggestions: [
          { id: '1', title: 'Item 1' },
          { id: '2', title: 'Item 2' },
          { id: '3', title: 'Item 3' },
          { id: '4', title: 'Item 4' },
          { id: '5', title: 'Item 5' },
        ],
      };
      mockHistoryService.createHistoryEntry.mockResolvedValue(mockHistoryItem);

      await controller.handleSuggestionCreated(dataWithMany);

      expect(historyService.createHistoryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestions: expect.arrayContaining([
            expect.objectContaining({ id: '1' }),
            expect.objectContaining({ id: '5' }),
          ]),
        }),
      );
    });

    it('should handle service errors during event processing', async () => {
      mockHistoryService.createHistoryEntry.mockRejectedValue(
        new Error('Failed to create history'),
      );

      await expect(
        controller.handleSuggestionCreated(mockEventData),
      ).rejects.toThrow('Failed to create history');
    });

    it('should handle event with complex criteria', async () => {
      const complexData = {
        userId: 'user-123',
        criteria: {
          category: 'books',
          mood: 'happy',
          genre: 'fiction',
          event: 'party',
          custom: { key: 'value' },
        },
        suggestions: [{ id: '1', title: 'Book 1' }],
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      mockHistoryService.createHistoryEntry.mockResolvedValue(mockHistoryItem);

      await controller.handleSuggestionCreated(complexData);

      expect(historyService.createHistoryEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          criteria: expect.objectContaining({
            category: 'books',
            mood: 'happy',
            genre: 'fiction',
            event: 'party',
          }),
        }),
      );
    });
  });

  describe('Header handling', () => {
    it('should extract userId from X-User-Id header in getUserHistory', async () => {
      mockHistoryService.getUserHistory.mockResolvedValue([]);

      await controller.getAll('header-user-123');

      expect(historyService.getUserHistory).toHaveBeenCalledWith(
        'header-user-123',
      );
    });

    it('should extract userId from X-User-Id header in getUserStats', async () => {
      mockHistoryService.getUserStats.mockResolvedValue(mockStats);

      await controller.getStats('header-user-456');

      expect(historyService.getUserStats).toHaveBeenCalledWith(
        'header-user-456',
      );
    });

    it('should extract userId from X-User-Id header in getHistoryItem', async () => {
      mockHistoryService.getHistoryItem.mockResolvedValue(mockHistoryItem);

      await controller.getById('history-123', 'header-user-789');

      expect(historyService.getHistoryItem).toHaveBeenCalledWith(
        'history-123',
        'header-user-789',
      );
    });
  });
});
