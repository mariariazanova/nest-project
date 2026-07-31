import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UserChoiceDto {
  @ApiPropertyOptional({
    example: 'books',
    description: 'books | films | games | songs',
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'calm' })
  @IsString()
  @IsOptional()
  mood?: string;

  @ApiPropertyOptional({ example: 'birthday' })
  @IsString()
  @IsOptional()
  event?: string;

  @ApiPropertyOptional({ example: 'fantasy' })
  @IsString()
  @IsOptional()
  genre?: string;
}
