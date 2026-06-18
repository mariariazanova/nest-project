import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { SuggestionHistory, SuggestionHistorySchema } from './schemas/suggestion-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SuggestionHistory.name, schema: SuggestionHistorySchema }]),
  ],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
