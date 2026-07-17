import {
  Controller,
  Headers,
  Get,
  Param,
  Logger,
  Inject,
  NotFoundException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TsRest, NestControllerInterface } from '@ts-rest/nest';
import { suggestionContract, Status } from '@suggestify/shared/contract';
import { SuggestionService } from './suggestion.service';
import { FilterItemsDto } from './dto/filter-items.dto';

@TsRest({})
@ApiTags('suggestions')
@Controller('suggestion')
// Method names must match the route keys defined in suggestionContract
export class SuggestionController
  implements NestControllerInterface<typeof suggestionContract>
{
  private readonly logger = new Logger(SuggestionController.name);

  constructor(
    private readonly suggestionService: SuggestionService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get filtered suggestions by category, mood, genre, and event',
  })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Authenticated user ID (injected by API Gateway)',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    example: 'books',
    description: 'books | films | games | songs',
  })
  @ApiQuery({ name: 'mood', required: false, example: 'calm' })
  @ApiQuery({ name: 'genre', required: false, example: 'fantasy' })
  @ApiQuery({ name: 'event', required: false, example: 'birthday' })
  @ApiResponse({
    status: Status.Ok,
    description: 'List of suggestions matching the criteria.',
  })
  async getFiltered(
    @Query('category') category: string,
    @Query('mood') mood: string,
    @Query('genre') genre: string,
    @Query('event') event: string,
    @Headers('X-User-Id') userId: string,
  ) {
    this.logger.log(`[Request] GET /suggestion - userId: ${userId}`);

    const dto: FilterItemsDto = {
      criteria: { category, mood, genre, event },
    };

    this.logger.debug(`Request criteria: ${JSON.stringify(dto.criteria)}`);

    const cacheKey = this.generateCacheKey(dto);
    const cached = await this.cacheManager.get(cacheKey);
    this.logger.debug(`Cached: ${cacheKey} ${cached}`);

    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return { status: Status.Ok, body: cached as any };
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);
    const result = await this.suggestionService.findManyByProperty(dto, userId);

    await this.cacheManager.set(cacheKey, result, 1800000); // 30 min
    this.logger.log(`[Response] Returning ${result.items?.length} suggestions`);

    return { status: Status.Ok, body: result };
  }

  @Get(':category/:id')
  @ApiOperation({ summary: 'Get a single suggestion item by category and ID' })
  @ApiParam({
    name: 'category',
    example: 'books',
    description: 'books | films | games | songs',
  })
  @ApiParam({ name: 'id', example: '42' })
  @ApiResponse({ status: Status.Ok, description: 'Suggestion item.' })
  @ApiResponse({ status: Status.NotFound, description: 'Not found.' })
  async getOne(@Param('category') category: string, @Param('id') id: string) {
    this.logger.log(`[Request] GET /suggestion/${category}/${id}`);

    const cacheKey = `suggestion:${category}:${id}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return { status: Status.Ok, body: cached as any };
    }

    this.logger.log(`[Cache MISS] ${cacheKey} - fetching from service`);

    const result = await this.suggestionService.findOne(category, id);

    if (!result) {
      this.logger.warn(`[Not Found] ${category}/${id} - no suggestion found`);
      throw new NotFoundException(`Suggestion not found: ${category}/${id}`);
    }

    await this.cacheManager.set(cacheKey, result, 3600000); // 1 hour
    this.logger.log(`[Response] ${category}/${id} returned`);

    return { status: Status.Ok, body: result };
  }

  private generateCacheKey(dto: FilterItemsDto): string {
    const { category, mood, genre, event } = dto.criteria;

    return [
      'suggestions',
      category || 'all',
      mood || 'any',
      genre || 'any',
      event || 'any',
    ].join(':');
  }
}
