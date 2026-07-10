import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FavoriteCategory } from '../entities/favorite.entity';

export class CreateFavoriteDto {
  @ApiProperty({
    example: 'b3fa1c2d-4e5f-6789-abcd-ef0123456789',
    description: 'ID of the item in the source service',
  })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({
    enum: FavoriteCategory,
    example: FavoriteCategory.BOOK,
    description: 'books | films | games | songs',
  })
  @IsEnum(FavoriteCategory)
  @IsNotEmpty()
  category: FavoriteCategory;

  @ApiPropertyOptional({ example: 'The Hobbit' })
  @IsString()
  @IsOptional()
  title?: string;
}
