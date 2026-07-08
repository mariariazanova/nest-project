import { Controller, Get, Headers, Param, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ClsService } from 'nestjs-cls';
import { HistoryService } from './history.service';
import { CORRELATION_ID_KEY } from '@suggestify/backend/logger';

@Controller('history')
export class HistoryController {
  private readonly logger = new Logger(HistoryController.name);

  constructor(
    private readonly historyService: HistoryService,
    private readonly cls: ClsService,
  ) {}

  @Get()
  async getUserHistory(@Headers('X-User-Id') userId: string) {
    return this.historyService.getUserHistory(userId);
  }

  @Get('stats')
  async getUserStats(@Headers('X-User-Id') userId: string) {
    return this.historyService.getUserStats(userId);
  }

  @Get(':id')
  async getHistoryItem(
    @Param('id') id: string,
    @Headers('X-User-Id') userId: string,
  ) {
    return this.historyService.getHistoryItem(id, userId);
  }

  // Event Handlers (from RabbitMQ)
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
