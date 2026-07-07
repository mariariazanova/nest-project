import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserSuggestionEntity } from './user-suggestions.entity';
import { CategoryType } from '../interfaces/category';
import { Category } from '../enums/category';

@Entity('user_suggestion_categories')
export class UserSuggestionCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => UserSuggestionEntity,
    (suggestion) => suggestion.categories,
    {
      onDelete: 'CASCADE',
    },
  )
  userSuggestion: UserSuggestionEntity;

  @Index()
  @Column({ type: 'enum', enum: Category })
  mediaType: CategoryType;

  @Index()
  @Column({ type: 'uuid' })
  mediaId: string;
}
