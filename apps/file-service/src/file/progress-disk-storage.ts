import { StorageEngine } from 'multer';
import { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { SocketGateway } from '../socket/socket.gateway';

export class ProgressDiskStorage implements StorageEngine {
  constructor(
    private readonly tempDir: string,
    private readonly gateway: SocketGateway,
  ) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error: any, info?: Partial<Express.Multer.File>) => void,
  ) {
    const userId = req.headers['x-user-id'] as string;
    const fileId = uuid();
    const tempPath = path.join(this.tempDir, fileId);
    const total = parseInt(req.headers['content-length'] ?? '0');
    let received = 0;

    const writeStream = fs.createWriteStream(tempPath);

    file.stream.on('data', (chunk: Buffer) => {
      received += chunk.length;

      this.gateway.emitToUser(userId, 'upload-progress', {
        fileId,
        bytesReceived: received,
        totalBytes: total,
        percent: total > 0 ? Math.round((received / total) * 100) : 0,
      });
    });

    file.stream
      .pipe(writeStream)
      .on('error', (err) => {
        fs.unlink(tempPath, () => undefined);
        cb(err);
      })
      .on('finish', () =>
        cb(null, { filename: fileId, path: tempPath, size: received }),
      );
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (err: NodeJS.ErrnoException | null) => void,
  ) {
    fs.unlink(file.path, cb);
  }
}
