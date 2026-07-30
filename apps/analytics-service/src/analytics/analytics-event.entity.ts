import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('analytics_events')
export class AnalyticsEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Index()
  @Column()
  eventType: string;

  @Index()
  @Column()
  userId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Index()
  @Column({ type: 'date' })
  eventDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
