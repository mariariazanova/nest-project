import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { join } from 'path';

@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onModuleInit() {
    // migrate-mongo v14 is ESM-only. Webpack rewrites visible import() calls to
    // require(), which hits the package's CJS shim Proxy and returns Promises
    // instead of functions. new Function hides the import from webpack's parser
    // so Node.js executes it as a native ESM import at runtime.
    const { up, config } = await (new Function(
      'return import("migrate-mongo")',
    )() as Promise<typeof import('migrate-mongo')>);
    config.set({
      migrationsDir: join(__dirname, 'migrations'),
      changelogCollectionName: 'migrations_changelog',
      migrationFileExtension: '.js',
    });
    const migrated = await up(this.connection.db, this.connection.getClient());
    migrated.forEach((name) => this.logger.log(`Migration applied: ${name}`));
  }
}
