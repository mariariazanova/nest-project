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
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteCategory } from './entities/favorite.entity';

@ApiTags('favorites')
@Controller('favorite')
export class FavoriteController {
  private readonly logger = new Logger(FavoriteController.name);

  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  @ApiOperation({ summary: 'Get all favorites for the authenticated user' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Authenticated user ID (injected by API Gateway)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: FavoriteCategory,
    description: 'Filter by category',
  })
  @ApiResponse({ status: 200, description: 'Array of favorite items.' })
  @ApiResponse({ status: 400, description: 'Missing X-User-Id header.' })
  async getUserFavorites(
    @Headers('X-User-Id') userId: string,
    @Query('category') category?: string,
  ) {
    this.logger.log(
      `GET /favorite - userId: ${userId}, category: ${category || 'all'}`,
    );

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    let favoriteCategory: FavoriteCategory | undefined;

    if (category) {
      if (
        !Object.values(FavoriteCategory).includes(category as FavoriteCategory)
      ) {
        throw new BadRequestException(
          `Invalid category. Must be one of: ${Object.values(FavoriteCategory).join(', ')}`,
        );
      }
      favoriteCategory = category as FavoriteCategory;
    }

    return this.favoriteService.getUserFavorites(userId, favoriteCategory);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single favorite by ID' })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiParam({ name: 'id', description: 'Favorite record UUID' })
  @ApiResponse({ status: 200, description: 'Favorite item.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async getFavoriteById(
    @Param('id') id: string,
    @Headers('X-User-Id') userId: string,
  ) {
    this.logger.log(`GET /favorite/${id} - userId: ${userId}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    return this.favoriteService.getFavoriteById(userId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an item to favorites' })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiBody({ type: CreateFavoriteDto })
  @ApiResponse({ status: 201, description: 'Favorite created.' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or missing header.',
  })
  async addFavorite(
    @Body() dto: CreateFavoriteDto,
    @Headers('X-User-Id') userId: string,
  ) {
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
  @ApiOperation({ summary: 'Remove a favorite by ID' })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiParam({ name: 'id', description: 'Favorite record UUID' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async removeFavorite(
    @Param('id') id: string,
    @Headers('X-User-Id') userId: string,
  ) {
    this.logger.log(`DELETE /favorite/${id} - userId: ${userId}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    await this.favoriteService.removeFavorite(userId, id);
  }

  @Get('check/:category/:itemId')
  @ApiOperation({
    summary: "Check if a specific item is in the user's favorites",
  })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiParam({ name: 'category', enum: FavoriteCategory })
  @ApiParam({ name: 'itemId', example: 'b3fa1c2d-4e5f-6789-abcd-ef0123456789' })
  @ApiResponse({ status: 200, description: '{ isFavorite: boolean }' })
  async checkFavorite(
    @Param('category') category: string,
    @Param('itemId') itemId: string,
    @Headers('X-User-Id') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    if (
      !Object.values(FavoriteCategory).includes(category as FavoriteCategory)
    ) {
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
