import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FavoriteEntity, FavoriteCategory } from './entities/favorite.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Injectable()
export class FavoriteService {
  private readonly logger = new Logger(FavoriteService.name);
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    @InjectRepository(FavoriteEntity)
    private readonly favoriteRepo: Repository<FavoriteEntity>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getUserFavorites(userId: string, category?: FavoriteCategory): Promise<FavoriteEntity[]> {
    this.logger.log(`Fetching favorites for user: ${userId}, category: ${category || 'all'}`);

    const cacheKey = `favorites:user:${userId}:${category || 'all'}`;
    const cached = await this.cacheManager.get<FavoriteEntity[]>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache HIT: ${cacheKey}`);
      return cached;
    }

    const where: Record<string, unknown> = { userId };
    if (category) {
      where.category = category;
    }

    const favorites = await this.favoriteRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });

    await this.cacheManager.set(cacheKey, favorites, this.CACHE_TTL);
    return favorites;
  }

  async addFavorite(userId: string, dto: CreateFavoriteDto): Promise<FavoriteEntity> {
    this.logger.log(
      `Adding favorite for user: ${userId}, item: ${dto.itemId}, category: ${dto.category}`,
    );

    const existing = await this.favoriteRepo.findOne({
      where: { userId, itemId: dto.itemId, category: dto.category },
    });

    if (existing) {
      throw new ConflictException('Item is already in favorites');
    }

    const favorite = this.favoriteRepo.create({
      userId,
      itemId: dto.itemId,
      category: dto.category,
      title: dto.title,
    });

    const saved = await this.favoriteRepo.save(favorite);

    await this.invalidateUserCache(userId);

    this.logger.log(`Favorite added: ${saved.id} for user: ${userId}`);
    return saved;
  }

  async removeFavorite(userId: string, favoriteId: string): Promise<void> {
    this.logger.log(`Removing favorite: ${favoriteId} for user: ${userId}`);

    const favorite = await this.favoriteRepo.findOne({ where: { id: favoriteId } });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.favoriteRepo.delete(favoriteId);
    await this.invalidateUserCache(userId);

    this.logger.log(`Favorite removed: ${favoriteId}`);
  }

  async getFavoriteById(userId: string, favoriteId: string): Promise<FavoriteEntity> {
    const favorite = await this.favoriteRepo.findOne({ where: { id: favoriteId } });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return favorite;
  }

  async isFavorite(userId: string, itemId: string, category: FavoriteCategory): Promise<boolean> {
    const count = await this.favoriteRepo.count({ where: { userId, itemId, category } });
    return count > 0;
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    const categories = ['all', ...Object.values(FavoriteCategory)];
    await Promise.all(
      categories.map((cat) => this.cacheManager.del(`favorites:user:${userId}:${cat}`)),
    );
  }
}
