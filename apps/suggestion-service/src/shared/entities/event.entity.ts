import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { BookEntity } from '../../suggestion/entities/book.entity';
import { FilmEntity } from '../../suggestion/entities/film.entity';
import { SongEntity } from '../../suggestion/entities/song.entity';
import { GameEntity } from '../../suggestion/entities/game.entity';

@Entity()
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @ManyToMany(() => BookEntity, (book) => book.events)
  books: BookEntity[];

  @ManyToMany(() => FilmEntity, (film) => film.events)
  films: FilmEntity[];

  @ManyToMany(() => SongEntity, (song) => song.events)
  songs: SongEntity[];

  @ManyToMany(() => GameEntity, (game) => game.events)
  games: GameEntity[];
}
