import { DeepPartial } from 'typeorm';
import { MoodEntity } from '../../shared/entities/mood.entity';

export const moods: DeepPartial<MoodEntity>[] = [
  { name: 'dark' },
  { name: 'funny' },
  { name: 'happy' },
  { name: 'intriguing' },
  { name: 'melancholic' },
  { name: 'relaxing' },
  { name: 'romantic' },
  { name: 'sad' },
];
