import { Module } from '@nestjs/common';
import { TypeOrmHealthIndicator } from '@nestjs/terminus';
import {
  HealthModule as SharedHealthModule,
  HEALTH_INDICATORS,
} from '@suggestify/backend/health';

@Module({
  imports: [SharedHealthModule],
  providers: [
    {
      provide: HEALTH_INDICATORS,
      useFactory: (db: TypeOrmHealthIndicator) => [
        () => db.pingCheck('database'),
      ],
      inject: [TypeOrmHealthIndicator],
    },
  ],
})
export class HealthModule {}
