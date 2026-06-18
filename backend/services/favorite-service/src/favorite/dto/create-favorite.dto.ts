import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FavoriteCategory } from '../entities/favorite.entity';

export class CreateFavoriteDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsEnum(FavoriteCategory)
  @IsNotEmpty()
  category: FavoriteCategory;

  @IsString()
  @IsOptional()
  title?: string;
}
