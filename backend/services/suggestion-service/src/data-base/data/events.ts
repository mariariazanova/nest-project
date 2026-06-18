import { DeepPartial } from 'typeorm';
import { EventEntity } from '../../shared/entities/event.entity';

export const events: DeepPartial<EventEntity>[] = [
  { name: 'wedding' },
  { name: 'disaster' },
  { name: 'journey' },
  { name: 'revenge' },
  { name: 'friendship' },
  { name: 'war' },
  { name: 'magic' },
  { name: 'love' },
  { name: 'family' },
  { name: 'betrayal' },
  { name: 'discovery' },
  { name: 'death' },
  { name: 'holidays' },
  { name: 'rescue' },
  { name: 'sacrifice' },
  { name: 'reunion' },
  { name: 'mystery' },
  { name: 'challenge' },
  { name: 'realization' },
];
