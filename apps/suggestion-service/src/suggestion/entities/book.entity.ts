import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MoodEntity } from '../../shared/entities/mood.entity';
import { GenreEntity } from '../../shared/entities/genre.entity';
import { EventEntity } from '../../shared/entities/event.entity';

@Entity('books')
export class BookEntity {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column()
  title: string;

  @Column()
  author: string;

  @Column({ nullable: true })
  description?: string;

  @ManyToMany(() => MoodEntity, (mood) => mood.books, { eager: true })
  @JoinTable({
    name: 'book_moods',
    joinColumn: { name: 'book_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'mood_id', referencedColumnName: 'id' },
  })
  moods: MoodEntity[];

  @ManyToMany(() => GenreEntity, (genre) => genre.books, { eager: true })
  @JoinTable({
    name: 'book_genres',
    joinColumn: { name: 'book_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres: GenreEntity[];

  @ManyToMany(() => EventEntity, (event) => event.books, { eager: true })
  @JoinTable({
    name: 'book_events',
    joinColumn: { name: 'book_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  events: EventEntity[];
}
