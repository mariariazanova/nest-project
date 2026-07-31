import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { KafkaModule } from '@suggestify/backend/kafka';
import { FileEntity } from './entities/file.entity';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { SocketModule } from '../socket/socket.module';
import { SocketGateway } from '../socket/socket.gateway';
import { ProgressDiskStorage } from './progress-disk-storage';

@Module({
  imports: [
    KafkaModule,
    TypeOrmModule.forFeature([FileEntity]),
    SocketModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService, SocketGateway],
      useFactory: (config: ConfigService, gateway: SocketGateway) => ({
        storage: new ProgressDiskStorage(
          config.get<string>('UPLOAD_TEMP_DIR', '/uploads/temp'),
          gateway,
        ),
        limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB custom limit — Multer aborts the stream if exceeded
      }),
    }),
  ],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
