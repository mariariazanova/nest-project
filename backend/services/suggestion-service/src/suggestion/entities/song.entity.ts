import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MoodEntity } from '../../shared/entities/mood.entity';
import { GenreEntity } from '../../shared/entities/genre.entity';
import { EventEntity } from '../../shared/entities/event.entity';

@Entity('songs')
export class SongEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  singer: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToMany(() => MoodEntity, (mood) => mood.songs, { eager: true })
  @JoinTable({
    name: 'song_moods',
    joinColumn: { name: 'song_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mood_id', referencedColumnName: 'id' },
  })
  moods: MoodEntity[];

  @ManyToMany(() => GenreEntity, (genre) => genre.songs, { eager: true })
  @JoinTable({
    name: 'song_genres',
    joinColumn: { name: 'song_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: GenreEntity[];

  @ManyToMany(() => EventEntity, (event) => event.songs, { eager: true })
  @JoinTable({
    name: 'song_events',
    joinColumn: { name: 'song_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  events: EventEntity[];
}
