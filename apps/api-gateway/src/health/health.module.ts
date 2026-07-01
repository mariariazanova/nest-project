import { Module } from '@nestjs/common';
import { HttpHealthIndicator } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthModule as SharedHealthModule, HEALTH_INDICATORS } from '@suggestify/backend/health';

@Module({
  imports: [SharedHealthModule, HttpModule],
  providers: [
    {
      provide: HEALTH_INDICATORS,
      useFactory: (http: HttpHealthIndicator) => [
        () => http.pingCheck('auth-service', 'http://auth-service:3001/health'),
      ],
      inject: [HttpHealthIndicator],
    },
  ],
})
export class HealthModule {}
