import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { TsRestModule } from '@ts-rest/nest';
import { HealthModule } from './health/health.module';
import { ConsulModule } from '@suggestify/backend/consul';
import { FileEntity } from './file/entities/file.entity';
import { MetricsModule } from '@suggestify/backend/metrics';
import { LoggerModule } from '@suggestify/backend/logger';
import { SocketGateway } from './socket/socket.gateway';

@Module({
  imports: [
    TsRestModule.register({ isGlobal: true }),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: [FileEntity],
        synchronize: false,
        migrationsRun: true,
        migrations: [],
        logging: config.get<string>('NODE_ENV') === 'development',
        ssl:
          config.get<string>('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRATION', '1d'),
        },
      }),
    }),

    HealthModule,

    ConsulModule.forRoot({
      serviceName: 'file-service',
      servicePort: 3005,
      tags: ['files', 'microservice', 'nestjs'],
    }),
    MetricsModule,
    LoggerModule.forRoot({ serviceName: 'file-service' }),
  ],
  providers: [SocketGateway],
})
export class AppModule {}
