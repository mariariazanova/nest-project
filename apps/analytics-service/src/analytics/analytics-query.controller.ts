import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Status } from '@suggestify/shared/contract';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsQueryController {
  private readonly logger = new Logger(AnalyticsQueryController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('events')
  @ApiOperation({ summary: 'Get paginated raw event log' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({
    status: Status.Ok,
    description: 'Paginated list of raw analytics events.',
  })
  getEvents(@Query('page') page = '1', @Query('limit') limit = '20') {
    this.logger.log(`GET /analytics/events - page: ${page}, limit: ${limit}`);
    return this.analyticsService.getEvents(Number(page), Number(limit));
  }

  @Get('suggestions/by-category')
  @ApiOperation({ summary: 'Get suggestion search counts grouped by category' })
  @ApiResponse({
    status: Status.Ok,
    description: 'Search counts per category.',
  })
  getSuggestionsByCategory() {
    this.logger.log('GET /analytics/suggestions/by-category');
    return this.analyticsService.getSuggestionsByCategory();
  }

  @Get('favorites/by-category')
  @ApiOperation({
    summary: 'Get favorite add/remove counts grouped by category',
  })
  @ApiResponse({
    status: Status.Ok,
    description: 'Add and remove counts per category.',
  })
  getFavoritesByCategory() {
    this.logger.log('GET /analytics/favorites/by-category');
    return this.analyticsService.getFavoritesByCategory();
  }

  @Get('files/summary')
  @ApiOperation({ summary: 'Get file operation counts and total upload size' })
  @ApiResponse({
    status: Status.Ok,
    description:
      'Upload, download, delete counts and total upload size in bytes.',
  })
  getFilesSummary() {
    this.logger.log('GET /analytics/files/summary');
    return this.analyticsService.getFilesSummary();
  }

  @Get('users/top')
  @ApiOperation({ summary: 'Get most active users by event count' })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Number of users to return (default: 10)',
  })
  @ApiResponse({
    status: Status.Ok,
    description: 'Top N users by total event count.',
  })
  getTopUsers(@Query('limit') limit = '10') {
    this.logger.log(`GET /analytics/users/top - limit: ${limit}`);
    return this.analyticsService.getTopUsers(Number(limit));
  }
}
