import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { BookEntity } from '../../suggestion/entities/book.entity';
import { FilmEntity } from '../../suggestion/entities/film.entity';
import { SongEntity } from '../../suggestion/entities/song.entity';
import { GameEntity } from '../../suggestion/entities/game.entity';

@Entity()
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => BookEntity, (book) => book.genres)
  books: BookEntity[];

  @ManyToMany(() => FilmEntity, (film) => film.genres)
  films: FilmEntity[];

  @ManyToMany(() => SongEntity, (song) => song.genres)
  songs: SongEntity[];

  @ManyToMany(() => GameEntity, (game) => game.genres)
  games: GameEntity[];
}
