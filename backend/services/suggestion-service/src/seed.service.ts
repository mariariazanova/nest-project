import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { BookEntity } from './suggestion/entities/book.entity';
import { FilmEntity } from './suggestion/entities/film.entity';
import { GameEntity } from './suggestion/entities/game.entity';
import { SongEntity } from './suggestion/entities/song.entity';
import { genres } from './data-base/data/genres';
import { moods } from './data-base/data/moods';
import { MoodEntity } from './shared/entities/mood.entity';
import { GenreEntity } from './shared/entities/genre.entity';
import { EventEntity } from './shared/entities/event.entity';
import { events } from './data-base/data/events';
import books from './data-base/data/books';
import songs from './data-base/data/songs';
import games from './data-base/data/games';
import films from './data-base/data/films';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(MoodEntity)
    private readonly moodRepo: Repository<MoodEntity>,

    @InjectRepository(GenreEntity)
    private readonly genreRepo: Repository<GenreEntity>,

    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,

    @InjectRepository(BookEntity)
    private readonly bookRepo: Repository<BookEntity>,

    @InjectRepository(FilmEntity)
    private readonly filmRepo: Repository<FilmEntity>,

    @InjectRepository(GameEntity)
    private readonly gameRepo: Repository<GameEntity>,

    @InjectRepository(SongEntity)
    private readonly songRepo: Repository<SongEntity>,
  ) {}

  async seedData(): Promise<void> {
    await Promise.all([
      this.seedRepository(this.moodRepo, moods),
      this.seedRepository(this.genreRepo, genres),
      this.seedRepository(this.eventRepo, events),
    ]);

    const savedCategories = {
      moods: await this.moodRepo.find(),
      genres: await this.genreRepo.find(),
      events: await this.eventRepo.find(),
    };

    await Promise.all([
      this.seedItemsWithRelations<FilmEntity>(this.filmRepo, films, savedCategories),
      this.seedItemsWithRelations<BookEntity>(this.bookRepo, books, savedCategories),
      this.seedItemsWithRelations<SongEntity>(this.songRepo, songs, savedCategories),
      this.seedItemsWithRelations<GameEntity>(this.gameRepo, games, savedCategories),
    ]);
  }

  async seedItemsWithRelations<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repository: any,
    items: DeepPartial<T>[],
    savedCategories: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      moods: any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      genres: any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events: any[];
    },
    relationFields: string[] = ['moods', 'genres', 'events'],
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsToSave = items.map((item: any) => {
      const { moods, genres, events, ...rest } = item;
      void moods; // Mark as intentionally unused
      void genres;
      void events;

      return rest;
    });
    const savedItems = await repository.save(itemsToSave);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemsWithRelations = savedItems.map((savedItem: any, index: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalItem = items[index] as any;
      const result = { ...savedItem };

      relationFields.forEach((field) => {
        if (originalItem[field] && Array.isArray(originalItem[field])) {
          result[field] = originalItem[field]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((rel: any) =>
              savedCategories[field as keyof typeof savedCategories]?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (saved: any) => saved.name === rel.name,
              ),
            )
            .filter(Boolean);
        }
      });

      return result;
    });

    await repository.save(itemsWithRelations);
  }

  private async seedRepository<T>(repo: Repository<T>, data: DeepPartial<T>[]): Promise<void> {
    // await repo.clear();

    const count = await repo.count();

    if (!count) {
      await repo.save(data, {
        reload: false,
        transaction: true,
      });
    }
  }
}
