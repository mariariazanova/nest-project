import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as migrateMongoDb from 'migrate-mongo';

@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    const { up } = migrateMongoDb;
    const migrated = await up(this.connection.db, this.connection.getClient());
    migrated.forEach((name) => this.logger.log(`Migration applied: ${name}`));
  }
}
