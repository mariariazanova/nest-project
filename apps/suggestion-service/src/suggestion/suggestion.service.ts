import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ClientProxy } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

import { FilterItemsDto } from './dto/filter-items.dto';
import { BookEntity } from './entities/book.entity';
import { FilmEntity } from './entities/film.entity';
import { GameEntity } from './entities/game.entity';
import { SongEntity } from './entities/song.entity';
import { Category } from './enums/category';
import { UserSuggestionEntity } from './entities/user-suggestions.entity';
import { Item, Suggestion } from './interfaces/suggestion';
import { UserSuggestionCategoryEntity } from './entities/user-suggestion-categories.entity';

@Injectable()
export class SuggestionService {
  private readonly logger = new Logger(SuggestionService.name);

  private categoryRepoMap: Record<Category, Repository<any>>;

  constructor(
    @InjectRepository(BookEntity)
    private readonly bookRepo: Repository<BookEntity>,

    @InjectRepository(FilmEntity)
    private readonly filmRepo: Repository<FilmEntity>,

    @InjectRepository(GameEntity)
    private readonly gameRepo: Repository<GameEntity>,

    @InjectRepository(SongEntity)
    private readonly songRepo: Repository<SongEntity>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,

    @Inject('HISTORY_SERVICE')
    private historyClient: ClientProxy,

    private readonly cls: ClsService,
  ) {
    this.categoryRepoMap = {
      [Category.BOOK]: this.bookRepo,
      [Category.FIlM]: this.filmRepo,
      [Category.GAME]: this.gameRepo,
      [Category.SONG]: this.songRepo,
    };
  }

  async findManyByProperty(
    dto: FilterItemsDto,
    userId: string,
  ): Promise<Suggestion> {
    this.logger.log(
      `Finding suggestions - userId: ${userId}, category: ${dto.criteria?.category}`,
    );

    const { category, mood, genre, event } = dto.criteria;
    const repo = this.categoryRepoMap[category];

    if (!repo) {
      this.logger.warn(`No repo for category ${category} found`);
      throw new NotFoundException(`Category ${category} not found`);
    }

    // Create alias by removing 's' from plural form
    const alias = category.slice(0, -1); // 'books' → 'book', 'films' → 'film'
    const query = repo
      .createQueryBuilder(alias)
      .leftJoinAndSelect(`${alias}.moods`, 'mood')
      .leftJoinAndSelect(`${alias}.genres`, 'genre')
      .leftJoinAndSelect(`${alias}.events`, 'event');

    // Apply filters
    if (mood) {
      query.andWhere('mood.name = :mood', { mood });
    }

    if (genre) {
      query.andWhere('genre.name = :genre', { genre });
    }

    if (event) {
      query.andWhere('event.name = :event', { event });
    }

    // Limit results
    query.take(20);

    const items = await query.getMany();
    this.logger.log(`Received result suggestions: ${items}`);

    // Create suggestion entity
    const suggestion = new UserSuggestionEntity();

    suggestion.id = userId;
    suggestion.criteria = dto.criteria;
    suggestion.recommendedAt = new Date();

    suggestion.categories = items.map((item) => {
      const cat = new UserSuggestionCategoryEntity();
      cat.mediaType = category as Category;
      cat.mediaId = item.id;
      cat.userSuggestion = suggestion;
      return cat;
    });

    // Emit event to History Service
    if (userId && items) {
      this.logger.log(`Emitting suggestion_created event for user ${userId}`);

      try {
        this.historyClient
          .emit('suggestion_created', {
            userId: userId,
            criteria: dto.criteria,
            suggestions: items.map((item) => ({
              id: item.id,
              title: item.title,
              category: category,
            })),
            timestamp: suggestion.recommendedAt.toISOString(),
            correlationId: this.cls.get(CORRELATION_ID_KEY),
          })
          .subscribe({
            next: () => this.logger.log('Event emitted successfully'),
            error: (err) => this.logger.error('Failed to emit event:', err),
          });
      } catch (error) {
        this.logger.error('Exception emitting event:', error);
      }
    }

    return this.enrichSuggestionWithMediaDetails(suggestion);
  }

  async findOne(category: string, id: string) {
    this.logger.log(
      `Finding one suggestion - category: ${category}, id: ${id}`,
    );

    const repo = this.categoryRepoMap[category];

    if (!repo) {
      this.logger.error(`Category "${category}" not found in map`);
      throw new NotFoundException(`Category ${category} not found`);
    }

    this.logger.log(`Repository found for category: ${category}`);

    // const cacheKey = `${category}:${id}`;

    // Try cache
    // const cached = await this.cacheManager.get(cacheKey);
    // if (cached) {
    //   this.logger.debug(`Cache hit for key: ${cacheKey}`);
    //   return cached;
    // }

    // Query database
    const item = await repo.findOne({
      where: { id },
      relations: { moods: true, genres: true, events: true },
    });

    if (!item) {
      this.logger.error(`Item NOT FOUND - category: ${category}, id: ${id}`);
      throw new NotFoundException(`Item not found`);
    }

    // Cache for 1 hour
    // await this.cacheManager.set(cacheKey, item, 3600000);

    this.logger.debug(`Item found: ${item.title}`);
    return item;
  }

  async enrichSuggestionWithMediaDetails(
    suggestion: UserSuggestionEntity,
  ): Promise<Suggestion> {
    const items = await this.extractSuggestionMediaDetails(suggestion);

    return <Suggestion>(<unknown>{
      id: suggestion.id,
      type: suggestion.categories[0]?.mediaType,
      items,
    });
  }

  private async extractSuggestionMediaDetails(
    suggestion: UserSuggestionEntity,
  ): Promise<Item[]> {
    const items: Item[] = [];

    for (const category of suggestion.categories) {
      let mediaItem = null;

      switch (category.mediaType) {
        case Category.BOOK:
          mediaItem = await this.bookRepo.findOne({
            where: { id: category.mediaId } as any,
          });
          break;
        case Category.FIlM:
          mediaItem = await this.filmRepo.findOne({
            where: { id: category.mediaId } as any,
          });
          break;
        case Category.GAME:
          mediaItem = await this.gameRepo.findOne({
            where: { id: category.mediaId } as any,
          });
          break;
        case Category.SONG:
          mediaItem = await this.songRepo.findOne({
            where: { id: category.mediaId } as any,
          });
          break;
      }

      if (mediaItem) {
        items.push(mediaItem as Item);
      }
    }

    return items;
  }
}
