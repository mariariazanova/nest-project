import { DataSource } from 'typeorm';
import { BookEntity } from './suggestion/entities/book.entity';
import { FilmEntity } from './suggestion/entities/film.entity';
import { GameEntity } from './suggestion/entities/game.entity';
import { SongEntity } from './suggestion/entities/song.entity';
import { MoodEntity } from './shared/entities/mood.entity';
import { GenreEntity } from './shared/entities/genre.entity';
import { EventEntity } from './shared/entities/event.entity';
import { UserEntity } from './suggestion/entities/user.entity';
import { UserSuggestionEntity } from './suggestion/entities/user-suggestions.entity';
import { UserSuggestionCategoryEntity } from './suggestion/entities/user-suggestion-categories.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'suggestions_db',
  entities: [
    BookEntity,
    FilmEntity,
    GameEntity,
    SongEntity,
    MoodEntity,
    GenreEntity,
    EventEntity,
    UserEntity,
    UserSuggestionEntity,
    UserSuggestionCategoryEntity,
  ],
  migrations: ['src/migrations/*.ts'],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
