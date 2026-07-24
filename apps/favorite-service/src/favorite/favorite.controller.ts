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
  BadRequestException,
  Inject,
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
import { ClientProxy } from '@nestjs/microservices';
import { TsRest, NestControllerInterface } from '@ts-rest/nest';
import { favoriteContract, Status } from '@suggestify/shared/contract';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteCategory } from './entities/favorite.entity';

@TsRest({})
@ApiTags('favorites')
@Controller('favorite')
// Method names must match the route keys defined in favoriteContract
export class FavoriteController
  implements NestControllerInterface<typeof favoriteContract>
{
  private readonly logger = new Logger(FavoriteController.name);

  constructor(
    private readonly favoriteService: FavoriteService,
    @Inject('RABBITMQ_CLIENT') private readonly rabbitMQClient: ClientProxy,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all favorites for the authenticated user' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Authenticated user ID (injected by API Gateway)',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: FavoriteCategory,
    description: 'Filter by category',
  })
  @ApiResponse({ status: Status.Ok, description: 'Array of favorite items.' })
  @ApiResponse({
    status: Status.BadRequest,
    description: 'Missing X-User-Id header.',
  })
  async getAll(
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

    const result = await this.favoriteService.getUserFavorites(
      userId,
      favoriteCategory,
    );

    return { status: Status.Ok, body: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single favorite by ID' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiParam({ name: 'id', description: 'Favorite record UUID' })
  @ApiResponse({ status: Status.Ok, description: 'Favorite item.' })
  @ApiResponse({ status: Status.NotFound, description: 'Not found.' })
  async getById(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    this.logger.log(`GET /favorite/${id} - userId: ${userId}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const result = await this.favoriteService.getFavoriteById(userId, id);

    return { status: Status.Ok, body: result };
  }

  @Post()
  @ApiOperation({ summary: 'Add an item to favorites' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiBody({ type: CreateFavoriteDto })
  @ApiResponse({ status: Status.Created, description: 'Favorite created.' })
  @ApiResponse({
    status: Status.BadRequest,
    description: 'Validation error or missing header.',
  })
  async add(
    @Body() dto: CreateFavoriteDto,
    @Headers('X-User-Id') userId: string,
  ) {
    this.logger.log(
      `POST /favorite - userId: ${userId}, itemId: ${dto.itemId}, category: ${dto.category}`,
    );

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    const result = await this.favoriteService.addFavorite(userId, dto);

    return { status: Status.Created, body: result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a favorite by ID' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiParam({ name: 'id', description: 'Favorite record UUID' })
  @ApiResponse({ status: Status.NoContent, description: 'Deleted.' })
  @ApiResponse({ status: Status.NotFound, description: 'Not found.' })
  async remove(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    this.logger.log(`DELETE /favorite/${id} - userId: ${userId}`);

    if (!userId) {
      throw new BadRequestException('Missing X-User-Id header');
    }

    await this.favoriteService.removeFavorite(userId, id);
    this.rabbitMQClient.emit('favorite.deleted', { favoriteId: id });

    return { status: Status.NoContent, body: undefined };
  }

  @Get('check/:category/:itemId')
  @ApiOperation({
    summary: "Check if a specific item is in the user's favorites",
  })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiParam({ name: 'category', enum: FavoriteCategory })
  @ApiParam({ name: 'itemId', example: 'b3fa1c2d-4e5f-6789-abcd-ef0123456789' })
  @ApiResponse({ status: Status.Ok, description: '{ isFavorite: boolean }' })
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

    return { status: Status.Ok, body: { isFavorite } };
  }
}
