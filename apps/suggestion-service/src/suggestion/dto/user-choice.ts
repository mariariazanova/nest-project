import { IsOptional, IsString } from 'class-validator';

export class UserChoiceDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  mood?: string;

  @IsString()
  @IsOptional()
  event?: string;

  @IsString()
  @IsOptional()
  genre?: string;
}
