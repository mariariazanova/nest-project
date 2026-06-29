import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SuggestionHistory, SuggestionHistoryDocument } from './schemas/suggestion-history.schema';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    @InjectModel(SuggestionHistory.name)
    private historyModel: Model<SuggestionHistoryDocument>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async createHistoryEntry(data: {
    userId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    criteria: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    suggestions: any[];
  }): Promise<SuggestionHistory> {
    this.logger.log(`Creating history entry for user: ${data.userId}`);

    try {
      const historyEntry = new this.historyModel({
        userId: data.userId,
        criteria: data.criteria,
        suggestions: data.suggestions,
        timestamp: new Date(),
        metadata: {
          source: 'web',
        },
      });

      const saved = await historyEntry.save();

      // Cache individual item WITH userId in key (security!)
      const itemCacheKey = `history:user:${data.userId}:item:${saved._id}`;
      await this.cacheManager.set(itemCacheKey, saved, 1800000); // 30 min

      this.logger.log(`History entry created: ${saved._id}`);
      return saved;
    } catch (error) {
      this.logger.error('Failed to create history entry', error);
      throw error;
    }
  }

  async getUserHistory(userId: string): Promise<SuggestionHistory[]> {
    this.logger.log(`Fetching history for user: ${userId}`);

    // const cacheKey = `history:${userId}`;

    // Try cache
    // const cached = await this.cacheManager.get<SuggestionHistory[]>(cacheKey);
    // if (cached) {
    //   this.logger.debug(`Cache hit for: ${cacheKey}`);
    //   return cached;
    // }

    // Query MongoDB
    const history = await this.historyModel.find({ userId }).sort({ timestamp: -1 }).exec();

    // Cache for 15 minutes
    // await this.cacheManager.set(cacheKey, history, 900000);

    return history;
  }

  async getHistoryItem(id: string, userId: string): Promise<SuggestionHistory> {
    const itemCacheKey = `history:user:${userId}:item:${id}`;
    this.logger.debug(
      `Get history item for userId: "${userId}", id: "${id}", ItemCacheKey: ${itemCacheKey}`,
    );

    // Try cache
    const cached = await this.cacheManager.get<SuggestionHistory>(itemCacheKey);
    this.logger.debug(`Is cached: ${cached}`);
    if (cached) {
      this.logger.debug(`Cache HIT for item: ${id} (user: ${userId})`);
      return cached;
    }

    // Query MongoDB
    this.logger.debug(`Cache MISS for item: ${id} (user: ${userId})`);
    const item = await this.historyModel
      .findOne({
        _id: id,
        userId: userId, // Security check - ensure item belongs to this user
      })
      .exec();
    this.logger.debug(`Item found: ${item}`);
    if (!item) {
      throw new NotFoundException('History item not found');
    }

    // Cache with user-scoped key (30 minutes)
    await this.cacheManager.set(itemCacheKey, item, 1800000);

    return item;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getUserStats(userId: string): Promise<any> {
    this.logger.log(`Calculating stats for user: ${userId}`);

    // const cacheKey = `stats:${userId}`;

    // Try cache
    // const cached = await this.cacheManager.get(cacheKey);
    // if (cached) {
    //   return cached;
    // }

    // Aggregate stats
    const stats = await this.historyModel.aggregate([
      { $match: { userId } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byCategoryArray: [
            { $unwind: '$criteria.category' },
            {
              $group: {
                _id: '$criteria.category',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          byMoodArray: [
            { $unwind: '$criteria.mood' },
            {
              $group: {
                _id: '$criteria.mood',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          recent: [
            { $sort: { timestamp: -1 } },
            { $limit: 5 },
            {
              $project: {
                criteria: 1,
                timestamp: 1,
                suggestionsCount: { $size: '$suggestions' },
              },
            },
          ],
        },
      },
    ]);

    const result = {
      totalSearches: stats[0]?.total[0]?.count || 0,
      byCategory: stats[0]?.byCategoryArray || [],
      byMood: stats[0]?.byMoodArray || [],
      recentSearches: stats[0]?.recent || [],
      userId,
      generatedAt: new Date(),
    };

    // Cache for 30 minutes
    // await this.cacheManager.set(cacheKey, result, 1800000);

    return result;
  }
}
