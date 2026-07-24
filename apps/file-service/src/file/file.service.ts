import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import sanitize from 'sanitize-filename';
import { FileEntity } from './entities/file.entity';
import { SocketGateway } from '../socket/socket.gateway';
import { ConfigService } from '@nestjs/config';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

@Injectable()
export class FileService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(FileEntity)
    private readonly repo: Repository<FileEntity>,
    private readonly jwtService: JwtService,
    private readonly gateway: SocketGateway,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR', '/uploads');
  }

  async upload(
    userId: string,
    file: Express.Multer.File,
    entityType?: string,
    entityId?: string,
  ): Promise<FileEntity> {
    // 1. Magic bytes check — read first bytes from temp file on disk (file.buffer is undefined with diskStorage)
    const fd = fs.openSync(file.path, 'r');
    const header = Buffer.alloc(4100);
    fs.readSync(fd, header, 0, 4100, 0);
    fs.closeSync(fd);

    const detected = await fileTypeFromBuffer(header);
    // file-type returns undefined for text formats (no magic bytes); fall back to multer's declared MIME type
    const mimeType = detected?.mime ?? file.mimetype;

    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      fs.unlinkSync(file.path);

      throw new BadRequestException(
        `File type ${mimeType ?? 'unknown'} is not allowed`,
      );
    }

    // 2. Sanitize original filename — strip path separators, null bytes, dangerous chars
    const safeName = sanitize(file.originalname) || 'unnamed';

    // 3. Move temp file to final UUID path — no user input ever appears in the disk path
    const fileId = file.filename; // UUID assigned by ProgressDiskStorage
    const finalDir = path.join(this.uploadDir, userId, fileId);
    fs.mkdirSync(finalDir, { recursive: true });
    fs.renameSync(file.path, path.join(finalDir, 'file'));

    // 4. Save entity and emit upload-complete
    const entity = await this.repo.save({
      id: fileId,
      originalName: safeName,
      mimeType: mimeType,
      size: file.size,
      storagePath: path.join(finalDir, 'file'),
      uploadedBy: userId,
      entityType,
      entityId,
    });

    this.gateway.emitToUser(userId, 'upload-complete', {
      fileId,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      size: entity.size,
    });

    return entity;
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<FileEntity[]> {
    return this.repo.find({ where: { entityType, entityId } });
  }

  async findOne(fileId: string): Promise<FileEntity> {
    const file = await this.repo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  async deleteByEntity(entityType: string, entityId: string): Promise<void> {
    const files = await this.repo.find({ where: { entityType, entityId } });
    for (const file of files) {
      this.removeFromDisk(file.storagePath);
      await this.repo.delete(file.id);
    }
  }

  async createDownloadToken(userId: string, fileId: string): Promise<string> {
    const file = await this.repo.findOne({
      where: { id: fileId, uploadedBy: userId },
    });
    if (!file) throw new NotFoundException('File not found');
    return this.jwtService.sign(
      { fileId, storagePath: file.storagePath },
      { expiresIn: '60s' },
    );
  }

  async validateTokenAndGetPath(
    token: string,
    fileId: string,
  ): Promise<string> {
    let payload: { fileId: string; storagePath: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new ForbiddenException('Invalid or expired download token');
    }
    if (payload.fileId !== fileId) {
      throw new ForbiddenException('Token does not match file');
    }
    if (!fs.existsSync(payload.storagePath)) {
      throw new NotFoundException('File not found on disk');
    }
    return payload.storagePath;
  }

  async delete(userId: string, fileId: string): Promise<void> {
    const file = await this.repo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (file.uploadedBy !== userId)
      throw new ForbiddenException('Access denied');
    this.removeFromDisk(file.storagePath);
    await this.repo.delete(fileId);
  }

  private removeFromDisk(storagePath: string): void {
    const dir = path.dirname(storagePath); // /uploads/{userId}/{fileId}
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
