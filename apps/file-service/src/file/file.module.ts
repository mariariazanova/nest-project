import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from './entities/file.entity';
import { FileService } from './file.service';
import { SocketGateway } from '../socket/socket.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  providers: [FileService, SocketGateway],
  exports: [FileService],
})
export class FileModule {}
