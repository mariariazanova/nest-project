import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteCategory } from './entities/favorite.entity';

@Controller('favorite')
export class FavoriteController {
  private readonly logger = new Logger(FavoriteController.name);

  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  async getUserFavorites(
    @Headers('X-User-Id') userId: string,
    @Query('category') category?: string,
  ) {
    this.logger.log(`GET /favorite - userId: ${userId}, category: ${category || 'all'}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    let favoriteCategory: FavoriteCategory | undefined;

    if (category) {
      if (!Object.values(FavoriteCategory).includes(category as FavoriteCategory)) {
        throw new BadRequestException(
          `Invalid category. Must be one of: ${Object.values(FavoriteCategory).join(', ')}`,
        );
      }
      favoriteCategory = category as FavoriteCategory;
    }

    return this.favoriteService.getUserFavorites(userId, favoriteCategory);
  }

  @Get(':id')
  async getFavoriteById(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    this.logger.log(`GET /favorite/${id} - userId: ${userId}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    return this.favoriteService.getFavoriteById(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addFavorite(@Body() dto: CreateFavoriteDto, @Headers('X-User-Id') userId: string) {
    this.logger.log(
      `POST /favorite - userId: ${userId}, itemId: ${dto.itemId}, category: ${dto.category}`,
    );

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    return this.favoriteService.addFavorite(userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFavorite(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    this.logger.log(`DELETE /favorite/${id} - userId: ${userId}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    await this.favoriteService.removeFavorite(userId, id);
  }

  /**
   * GET /favorite/check/:category/:itemId
   * Checks if a specific item is in the user's favorites.
   */
  @Get('check/:category/:itemId')
  async checkFavorite(
    @Param('category') category: string,
    @Param('itemId') itemId: string,
    @Headers('X-User-Id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    if (!Object.values(FavoriteCategory).includes(category as FavoriteCategory)) {
      throw new BadRequestException(
        `Invalid category. Must be one of: ${Object.values(FavoriteCategory).join(', ')}`,
      );
    }

    const isFavorite = await this.favoriteService.isFavorite(
      userId,
      itemId,
      category as FavoriteCategory,
    );

    return { isFavorite };
  }
}
