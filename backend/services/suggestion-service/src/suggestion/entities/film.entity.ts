import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MoodEntity } from '../../shared/entities/mood.entity';
import { GenreEntity } from '../../shared/entities/genre.entity';
import { EventEntity } from '../../shared/entities/event.entity';

@Entity('films')
export class FilmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  director?: string;

  @Column({ nullable: true, type: 'int' })
  year?: number;

  @ManyToMany(() => MoodEntity, (mood) => mood.films, { eager: true })
  @JoinTable({
    name: 'film_moods',
    joinColumn: { name: 'film_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mood_id', referencedColumnName: 'id' },
  })
  moods: MoodEntity[];

  @ManyToMany(() => GenreEntity, (genre) => genre.films, { eager: true })
  @JoinTable({
    name: 'film_genres',
    joinColumn: { name: 'film_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: GenreEntity[];

  @ManyToMany(() => EventEntity, (event) => event.films, { eager: true })
  @JoinTable({
    name: 'film_events',
    joinColumn: { name: 'film_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  events: EventEntity[];
}
