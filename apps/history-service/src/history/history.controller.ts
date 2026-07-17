import { Controller, Get, Headers, Param, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiParam,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { TsRest, NestControllerInterface } from '@ts-rest/nest';
import { historyContract, Status } from '@suggestify/shared/contract';
import { HistoryService } from './history.service';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

@TsRest({})
@ApiTags('history')
@Controller('history')
// Method names must match the route keys defined in historyContract
export class HistoryController
  implements NestControllerInterface<typeof historyContract>
{
  private readonly logger = new Logger(HistoryController.name);

  constructor(
    private readonly historyService: HistoryService,
    private readonly cls: ClsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all suggestion history entries for the authenticated user',
  })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    description: 'Authenticated user ID (injected by API Gateway)',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({ status: Status.Ok, description: 'Array of history entries.' })
  async getAll(@Headers('X-User-Id') userId: string) {
    const result = await this.historyService.getUserHistory(userId);

    return {
      status: Status.Ok,
      body: result.map((h) => ({
        _id: String((h as any)._id),
        userId: h.userId,
        criteria: h.criteria,
        suggestions: h.suggestions,
        timestamp: h.timestamp,
      })),
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get aggregated suggestion statistics for the user',
  })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({ status: Status.Ok, description: 'User stats object.' })
  async getStats(@Headers('X-User-Id') userId: string) {
    const result = await this.historyService.getUserStats(userId);

    return { status: Status.Ok, body: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single history entry by ID' })
  @ApiHeader({
    name: 'X-User-Id',
    required: true,
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: Status.Ok, description: 'History entry.' })
  @ApiResponse({ status: Status.NotFound, description: 'Not found.' })
  async getById(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    const result = await this.historyService.getHistoryItem(id, userId);

    return {
      status: Status.Ok,
      body: {
        _id: String((result as any)._id),
        userId: result.userId,
        criteria: result.criteria,
        suggestions: result.suggestions,
        timestamp: result.timestamp,
      },
    };
  }

  // Event Handlers (from RabbitMQ)
  @ApiExcludeEndpoint()
  @EventPattern('suggestion_created')
  async handleSuggestionCreated(
    @Payload()
    data: {
      userId: string;
      criteria: any;
      suggestions: any[];
      timestamp?: string;
      correlationId?: string;
    },
  ) {
    return this.cls.run(async () => {
      if (data.correlationId) {
        this.cls.set(CORRELATION_ID_KEY, data.correlationId);
      }
      return this.historyService.createHistoryEntry(data);
    });
  }
}
