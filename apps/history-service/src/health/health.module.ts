import { Module } from '@nestjs/common';
import { MongooseHealthIndicator } from '@nestjs/terminus';
import { HealthModule as SharedHealthModule, HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  imports: [SharedHealthModule],
  providers: [
    {
      provide: HEALTH_INDICATORS,
      useFactory: (db: MongooseHealthIndicator) => [
        () => db.pingCheck('database'),
      ],
      inject: [MongooseHealthIndicator],
    },
  ],
})
export class HealthModule {}
