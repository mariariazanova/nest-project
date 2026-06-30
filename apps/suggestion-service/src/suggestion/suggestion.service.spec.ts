import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { SuggestionService } from './suggestion.service';
import { BookEntity } from './entities/book.entity';
import { FilmEntity } from './entities/film.entity';
import { GameEntity } from './entities/game.entity';
import { SongEntity } from './entities/song.entity';
import { FilterItemsDto } from './dto/filter-items.dto';
import { Category } from './enums/category';
import { UserChoice } from './interfaces/suggestion';
import { UserSuggestionEntity } from './entities/user-suggestions.entity';

describe('SuggestionService', () => {
  let service: SuggestionService;
  let bookRepo: Repository<BookEntity>;
  let filmRepo: Repository<FilmEntity>;
  let gameRepo: Repository<GameEntity>;
  let songRepo: Repository<SongEntity>;
  let historyClient: ClientProxy;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueryBuilder: any;

  const createMockQueryBuilder = () => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  });

  const createMockRepository = () => ({
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  });

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockHistoryClient = {
    emit: jest.fn().mockReturnValue(of({})),
  };

  beforeEach(async () => {
    // Create fresh query builder for each test
    mockQueryBuilder = createMockQueryBuilder();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionService,
        {
          provide: getRepositoryToken(BookEntity),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(FilmEntity),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(GameEntity),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(SongEntity),
          useValue: createMockRepository(),
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: 'HISTORY_SERVICE',
          useValue: mockHistoryClient,
        },
      ],
    }).compile();

    service = module.get(SuggestionService);
    bookRepo = module.get(getRepositoryToken(BookEntity));
    filmRepo = module.get(getRepositoryToken(FilmEntity));
    gameRepo = module.get(getRepositoryToken(GameEntity));
    songRepo = module.get(getRepositoryToken(SongEntity));
    historyClient = module.get('HISTORY_SERVICE');

    // Setup createQueryBuilder to return our mock
    (bookRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
    (filmRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
    (gameRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);
    (songRepo.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findManyByProperty', () => {
    const mockDto: FilterItemsDto = {
      criteria: {
        category: Category.BOOK,
        mood: 'happy',
        genre: 'fiction',
        event: 'party',
      },
    };
    const mockUserId = 'user-123';
    const mockBooks = [
      {
        id: '1',
        title: 'Book 1',
        moods: [{ name: 'happy' }],
        genres: [{ name: 'fiction' }],
        events: [{ name: 'party' }],
      },
      {
        id: '2',
        title: 'Book 2',
        moods: [{ name: 'happy' }],
        genres: [{ name: 'fiction' }],
        events: [{ name: 'party' }],
      },
    ];

    it('should find suggestions with all filters applied', async () => {
      mockQueryBuilder.getMany.mockResolvedValue(mockBooks);
      // Mock the findOne calls for enrichment
      (bookRepo.findOne as jest.Mock).mockResolvedValue(mockBooks[0]);

      const result = await service.findManyByProperty(mockDto, mockUserId);

      expect(bookRepo.createQueryBuilder).toHaveBeenCalledWith('book');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('book.moods', 'mood');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('book.genres', 'genre');
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('book.events', 'event');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('mood.name = :mood', {
        mood: 'happy',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('genre.name = :genre', {
        genre: 'fiction',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.name = :event', {
        event: 'party',
      });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result.items).toHaveLength(2);
      expect(bookRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should find suggestions without filters', async () => {
      const dtoNoFilters: FilterItemsDto = {
        criteria: <UserChoice>{
          category: Category.BOOK,
        },
      };
      mockQueryBuilder.getMany.mockResolvedValue(mockBooks);
      (bookRepo.findOne as jest.Mock).mockResolvedValue(mockBooks[0]);

      await service.findManyByProperty(dtoNoFilters, mockUserId);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should throw NotFoundException for invalid category', async () => {
      const invalidDto: FilterItemsDto = {
        criteria: <UserChoice>{
          category: 'invalid' as Category,
        },
      };

      await expect(service.findManyByProperty(invalidDto, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findManyByProperty(invalidDto, mockUserId)).rejects.toThrow(
        'Category invalid not found',
      );
    });

    it('should emit event to history service on success', async () => {
      mockQueryBuilder.getMany.mockResolvedValue(mockBooks);
      (bookRepo.findOne as jest.Mock).mockResolvedValue(mockBooks[0]);

      await service.findManyByProperty(mockDto, mockUserId);

      expect(historyClient.emit).toHaveBeenCalledWith(
        'suggestion_created',
        expect.objectContaining({
          userId: mockUserId,
          criteria: mockDto.criteria,
          suggestions: expect.arrayContaining([
            expect.objectContaining({
              id: '1',
              title: 'Book 1',
              category: Category.BOOK,
            }),
          ]),
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle event emission error gracefully', async () => {
      mockQueryBuilder.getMany.mockResolvedValue(mockBooks);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockHistoryClient.emit.mockReturnValue(throwError(() => new Error('Event emission failed')));

      // Should not throw despite event emission failure
      const result = await service.findManyByProperty(mockDto, mockUserId);

      expect(result).toBeDefined();

      consoleErrorSpy.mockRestore();
    });

    it('should work with films category', async () => {
      const filmDto: FilterItemsDto = {
        criteria: <UserChoice>{
          category: Category.FIlM,
          mood: 'exciting',
        },
      };
      const mockFilms = [{ id: '1', title: 'Film 1' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockFilms);
      (filmRepo.findOne as jest.Mock).mockResolvedValue(mockFilms[0]);

      await service.findManyByProperty(filmDto, mockUserId);

      expect(filmRepo.createQueryBuilder).toHaveBeenCalledWith('film');
    });

    it('should work with games category', async () => {
      const gameDto: FilterItemsDto = {
        criteria: <UserChoice>{
          category: Category.GAME,
        },
      };
      const mockGames = [{ id: '1', title: 'Game 1' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockGames);
      (gameRepo.findOne as jest.Mock).mockResolvedValue(mockGames[0]);

      await service.findManyByProperty(gameDto, mockUserId);

      expect(gameRepo.createQueryBuilder).toHaveBeenCalledWith('game');
    });

    it('should work with songs category', async () => {
      const songDto: FilterItemsDto = {
        criteria: <UserChoice>{
          category: Category.SONG,
        },
      };
      const mockSongs = [{ id: '1', title: 'Song 1' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockSongs);
      (songRepo.findOne as jest.Mock).mockResolvedValue(mockSongs[0]);

      await service.findManyByProperty(songDto, mockUserId);

      expect(songRepo.createQueryBuilder).toHaveBeenCalledWith('song');
    });
  });

  describe('findOne', () => {
    const mockBook = {
      id: '123',
      title: 'Test Book',
      moods: [{ name: 'happy' }],
      genres: [{ name: 'fiction' }],
      events: [{ name: 'party' }],
    };

    it('should find one item by category and id', async () => {
      (bookRepo.find as jest.Mock).mockResolvedValue([mockBook]);
      (bookRepo.findOne as jest.Mock).mockResolvedValue(mockBook);

      const result = await service.findOne(Category.BOOK, '123');

      expect(bookRepo.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: { moods: true, genres: true, events: true },
      });
      expect(result).toEqual(mockBook);
    });

    it('should throw NotFoundException for invalid category', async () => {
      await expect(service.findOne('invalid', '123')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('invalid', '123')).rejects.toThrow('Category invalid not found');
    });

    it('should throw NotFoundException when item not found', async () => {
      (bookRepo.find as jest.Mock).mockResolvedValue([]);
      (bookRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(Category.BOOK, '999')).rejects.toThrow(NotFoundException);
      await expect(service.findOne(Category.BOOK, '999')).rejects.toThrow('Item not found');
    });

    it('should work with film category', async () => {
      const mockFilm = { id: '456', title: 'Test Film' };
      (filmRepo.find as jest.Mock).mockResolvedValue([mockFilm]);
      (filmRepo.findOne as jest.Mock).mockResolvedValue(mockFilm);

      const result = await service.findOne(Category.FIlM, '456');

      expect(filmRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockFilm);
    });

    it('should work with game category', async () => {
      const mockGame = { id: '789', title: 'Test Game' };
      (gameRepo.find as jest.Mock).mockResolvedValue([mockGame]);
      (gameRepo.findOne as jest.Mock).mockResolvedValue(mockGame);

      const result = await service.findOne(Category.GAME, '789');

      expect(gameRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockGame);
    });

    it('should work with song category', async () => {
      const mockSong = { id: '101', title: 'Test Song' };
      (songRepo.find as jest.Mock).mockResolvedValue([mockSong]);
      (songRepo.findOne as jest.Mock).mockResolvedValue(mockSong);

      const result = await service.findOne(Category.SONG, '101');

      expect(songRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockSong);
    });
  });

  describe('enrichSuggestionWithMediaDetails', () => {
    it('should enrich suggestion with media details', async () => {
      const mockSuggestion = <UserSuggestionEntity>{
        id: 'user-123',
        categories: [
          { mediaType: Category.BOOK, mediaId: '1' },
          { mediaType: Category.FIlM, mediaId: '2' },
        ],
      };

      const mockBook = { id: '1', title: 'Book 1' };
      const mockFilm = { id: '2', title: 'Film 1' };

      (bookRepo.findOne as jest.Mock).mockResolvedValue(mockBook);
      (filmRepo.findOne as jest.Mock).mockResolvedValue(mockFilm);

      const result = await service.enrichSuggestionWithMediaDetails(mockSuggestion);

      expect(result.id).toBe('user-123');
      expect(result.type).toBe(Category.BOOK);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(mockBook);
      expect(result.items[1]).toEqual(mockFilm);
    });

    it('should skip items that are not found', async () => {
      const mockSuggestion = <UserSuggestionEntity>{
        id: 'user-123',
        categories: [
          { mediaType: Category.BOOK, mediaId: '1' },
          { mediaType: Category.FIlM, mediaId: '999' }, // This won't be found
        ],
      };

      const mockBook = { id: '1', title: 'Book 1' };

      (bookRepo.findOne as jest.Mock).mockResolvedValue(mockBook);
      (filmRepo.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.enrichSuggestionWithMediaDetails(mockSuggestion);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(mockBook);
    });
  });
});
