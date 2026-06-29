import { Controller, Get, Headers, Param, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  private readonly logger = new Logger(HistoryController.name);

  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async getUserHistory(@Headers('X-User-Id') userId: string) {
    return this.historyService.getUserHistory(userId);
  }

  @Get('stats')
  async getUserStats(@Headers('X-User-Id') userId: string) {
    return this.historyService.getUserStats(userId);
  }

  @Get(':id')
  async getHistoryItem(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    return this.historyService.getHistoryItem(id, userId);
  }

  // Event Handlers (from RabbitMQ)
  @EventPattern('suggestion_created')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleSuggestionCreated(@Payload() data: any) {
    return this.historyService.createHistoryEntry(data);
  }
}
