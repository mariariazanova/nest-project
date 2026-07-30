import { Module } from '@nestjs/common';
import { HealthModule as SharedHealthModule } from '@suggestify/backend/health';

@Module({
  imports: [SharedHealthModule],
})
export class HealthModule {}
