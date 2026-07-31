import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { BookEntity } from '../../suggestion/entities/book.entity';
import { FilmEntity } from '../../suggestion/entities/film.entity';
import { SongEntity } from '../../suggestion/entities/song.entity';
import { GameEntity } from '../../suggestion/entities/game.entity';

@Entity()
export class MoodEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => BookEntity, (book) => book.moods)
  books: BookEntity[];

  @ManyToMany(() => FilmEntity, (film) => film.moods)
  films: FilmEntity[];

  @ManyToMany(() => SongEntity, (song) => song.moods)
  songs: SongEntity[];

  @ManyToMany(() => GameEntity, (game) => game.moods)
  games: GameEntity[];
}
