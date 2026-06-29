import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserSuggestionEntity } from './user-suggestions.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column()
  password: string;

  @OneToMany(() => UserSuggestionEntity, (suggestion) => suggestion.user)
  recommendations: UserSuggestionEntity[];
}
