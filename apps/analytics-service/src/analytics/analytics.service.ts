import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEventEntity } from './analytics-event.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEventEntity)
    private readonly repo: Repository<AnalyticsEventEntity>,
  ) {}

  async record(event: Record<string, unknown>): Promise<void> {
    const { eventId, eventType, userId, username, timestamp, ...payload } =
      event;
    const entity = this.repo.create({
      eventId: eventId as string,
      eventType: eventType as string,
      userId: userId as string,
      username: username as string,
      payload,
      eventDate: new Date(timestamp as string).toISOString().split('T')[0],
    });
    await this.repo.save(entity);
  }

  async getEvents(page: number, limit: number) {
    const [events, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { events, total, page, limit };
  }

  async getSuggestionsByCategory() {
    return this.repo
      .createQueryBuilder('e')
      .select("e.payload->>'category'", 'category')
      .addSelect('COUNT(e.id)', 'searchCount')
      .where('e.eventType = :type', { type: 'suggestion.searched' })
      .groupBy("e.payload->>'category'")
      .orderBy('COUNT(e.id)', 'DESC')
      .getRawMany();
  }

  async getFavoritesByCategory() {
    return this.repo
      .createQueryBuilder('e')
      .select("e.payload->>'category'", 'category')
      .addSelect('e.eventType', 'eventType')
      .addSelect('COUNT(e.id)', 'count')
      .where('e.eventType IN (:...types)', {
        types: ['favorite.added', 'favorite.removed'],
      })
      .groupBy("e.payload->>'category'")
      .addGroupBy('e.eventType')
      .orderBy("e.payload->>'category'")
      .getRawMany();
  }

  async getFilesSummary() {
    const counts = await this.repo
      .createQueryBuilder('e')
      .select('e.eventType', 'eventType')
      .addSelect('COUNT(e.id)', 'count')
      .where('e.eventType IN (:...types)', {
        types: ['file.uploaded', 'file.downloaded', 'file.deleted'],
      })
      .groupBy('e.eventType')
      .getRawMany();

    const sizeResult = await this.repo
      .createQueryBuilder('e')
      .select(
        "COALESCE(SUM((e.payload->>'size')::bigint), 0)",
        'totalUploadSize',
      )
      .where('e.eventType = :type', { type: 'file.uploaded' })
      .getRawOne();

    return {
      counts,
      totalUploadSize: Number(sizeResult?.totalUploadSize ?? 0),
    };
  }

  async getTopUsers(limit: number) {
    return this.repo
      .createQueryBuilder('e')
      .select('e.userId', 'userId')
      .addSelect('e.username', 'username')
      .addSelect('COUNT(e.id)', 'eventCount')
      .groupBy('e.userId')
      .addGroupBy('e.username')
      .orderBy('COUNT(e.id)', 'DESC')
      .limit(limit)
      .getRawMany();
  }
}
