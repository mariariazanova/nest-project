import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserChoiceDto } from './user-choice';
import { UserChoice } from '../interfaces/suggestion';

export class FilterItemsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UserChoiceDto)
  criteria: UserChoice;
}
