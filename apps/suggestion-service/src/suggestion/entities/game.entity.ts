import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MoodEntity } from '../../shared/entities/mood.entity';
import { GenreEntity } from '../../shared/entities/genre.entity';
import { EventEntity } from '../../shared/entities/event.entity';

@Entity('games')
export class GameEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  publisher?: string;

  @Index()
  @Column({ nullable: true, type: 'int' })
  year?: number;

  @ManyToMany(() => MoodEntity, (mood) => mood.games, { eager: true })
  @JoinTable({
    name: 'game_moods',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mood_id', referencedColumnName: 'id' },
  })
  moods: MoodEntity[];

  @ManyToMany(() => GenreEntity, (genre) => genre.games, { eager: true })
  @JoinTable({
    name: 'game_genres',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: GenreEntity[];

  @ManyToMany(() => EventEntity, (event) => event.games, { eager: true })
  @JoinTable({
    name: 'game_events',
    joinColumn: { name: 'game_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  events: EventEntity[];
}
