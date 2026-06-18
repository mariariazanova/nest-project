import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

export enum FavoriteCategory {
  BOOK = 'books',
  FILM = 'films',
  GAME = 'games',
  SONG = 'songs',
}

@Entity('favorites')
@Unique(['userId', 'itemId', 'category'])
export class FavoriteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  @Index()
  userId: string;

  @Column({ nullable: false })
  itemId: string;

  @Column({
    type: 'enum',
    enum: FavoriteCategory,
  })
  category: FavoriteCategory;

  @Column({ nullable: true })
  title?: string;

  @CreateDateColumn()
  createdAt: Date;
}
