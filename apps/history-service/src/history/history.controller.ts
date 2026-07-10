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
import { HistoryService } from './history.service';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

@ApiTags('history')
@Controller('history')
export class HistoryController {
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
  })
  @ApiResponse({ status: 200, description: 'Array of history entries.' })
  async getUserHistory(@Headers('X-User-Id') userId: string) {
    return this.historyService.getUserHistory(userId);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get aggregated suggestion statistics for the user',
  })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiResponse({ status: 200, description: 'User stats object.' })
  async getUserStats(@Headers('X-User-Id') userId: string) {
    return this.historyService.getUserStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single history entry by ID' })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'History entry.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  async getHistoryItem(
    @Param('id') id: string,
    @Headers('X-User-Id') userId: string,
  ) {
    return this.historyService.getHistoryItem(id, userId);
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
