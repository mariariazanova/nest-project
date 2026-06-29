import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserSuggestionEntity } from './user-suggestions.entity';
import { CategoryType } from '../interfaces/category';

@Entity('user_suggestion_categories')
export class UserSuggestionCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserSuggestionEntity, (suggestion) => suggestion.categories, {
    onDelete: 'CASCADE',
  })
  userSuggestion: UserSuggestionEntity;

  @Column()
  mediaType: CategoryType;

  @Column({ type: 'uuid' })
  mediaId: string;
}
