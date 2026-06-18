import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SuggestionHistoryDocument = SuggestionHistory & Document;

@Schema({ timestamps: true })
export class SuggestionHistory {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: Object, required: true })
  criteria: {
    category?: string[];
    mood?: string[];
    genre?: string[];
    event?: string[];
  };

  @Prop({ type: Array, required: true })
  suggestions: Array<{
    id: string;
    title: string;
    category: string;
  }>;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;

  @Prop({ type: Object })
  metadata?: {
    source?: string;
    device?: string;
    location?: string;
  };
}

export const SuggestionHistorySchema = SchemaFactory.createForClass(SuggestionHistory);

// Indexes for performance
SuggestionHistorySchema.index({ userId: 1, timestamp: -1 });
SuggestionHistorySchema.index({ 'criteria.category': 1 });
