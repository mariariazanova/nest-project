import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserChoice } from '../interfaces/suggestion';
import { UserEntity } from './user.entity';
import { UserSuggestionCategoryEntity } from './user-suggestion-categories.entity';

@Entity('user_suggestions')
export class UserSuggestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserEntity, (user) => user.recommendations, { onDelete: 'CASCADE' })
  user: UserEntity;

  @Column('jsonb')
  criteria: UserChoice;

  @CreateDateColumn()
  recommendedAt: Date;

  @OneToMany(() => UserSuggestionCategoryEntity, (category) => category.userSuggestion, {
    cascade: true,
  })
  categories: UserSuggestionCategoryEntity[];
}
