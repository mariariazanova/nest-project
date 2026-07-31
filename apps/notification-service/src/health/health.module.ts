import { Module } from '@nestjs/common';
import { HealthModule as SharedHealthModule } from '@suggestify/backend/health';

// No database — shared HealthModule provides memory checks via @Optional() HEALTH_INDICATORS.
@Module({
  imports: [SharedHealthModule],
})
export class HealthModule {}
