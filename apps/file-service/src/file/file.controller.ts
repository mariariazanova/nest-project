import {
  Controller,
  Get,
  Post,
  Delete,
  HttpCode,
  Headers,
  Param,
  Query,
  Body,
  Res,
  Logger,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiHeader,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TsRest, NestControllerInterface } from '@ts-rest/nest';
import { Response } from 'express';
import * as path from 'path';
import { fileContract, Status } from '@suggestify/shared/contract';
import { FileService } from './file.service';

@TsRest({})
@ApiTags('files')
@Controller('files')
export class FileController
  implements NestControllerInterface<typeof fileContract>
{
  private readonly logger = new Logger(FileController.name);

  constructor(private readonly fileService: FileService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file')) // storage + limits come from MulterModule.registerAsync
  @ApiOperation({
    summary: 'Upload a file, optionally associating it with an entity',
  })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string' },
        entityId: { type: 'string', format: 'uuid' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: Status.Created, description: 'File uploaded.' })
  @ApiResponse({ status: Status.BadRequest, description: 'Invalid file type.' })
  async upload(
    @Headers('X-User-Id') userId: string,
    @Body() body: { entityType?: string; entityId?: string },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            // Declared MIME first-pass filter — magic bytes check happens in FileService.
            // fallbackToMimetype required: disk storage leaves file.buffer undefined,
            // so NestJS 11's FileTypeValidator can't read magic bytes here.
            // SVG excluded: can contain embedded <script> tags (XSS)
            // Legacy Office excluded (.doc/.xls/.ppt): support macros; allow only OOXML variants
            fileType:
              /^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime|x-msvideo|webm)|audio\/(mpeg|wav|ogg|mp4)|application\/(pdf|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))|text\/(plain|csv))$/,
            fallbackToMimetype: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!userId) throw new BadRequestException('Missing X-User-Id header');

    this.logger.log(
      `POST /files - userId: ${userId}, originalName: ${file?.originalname}`,
    );
    const result = await this.fileService.upload(
      userId,
      file,
      body.entityType,
      body.entityId,
    );

    return { status: Status.Created, body: result };
  }

  @Get()
  @ApiOperation({ summary: 'Get all files associated with a given entity' })
  @ApiQuery({ name: 'entityType', required: true })
  @ApiQuery({ name: 'entityId', required: true })
  @ApiResponse({ status: Status.Ok, description: 'Array of files.' })
  async getByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    if (!entityType || !entityId)
      throw new BadRequestException('entityType and entityId are required');

    this.logger.log(`GET /files?entityType=${entityType}&entityId=${entityId}`);
    const result = await this.fileService.findByEntity(entityType, entityId);

    return { status: Status.Ok, body: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get metadata for a single file' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: Status.Ok, description: 'File metadata.' })
  @ApiResponse({ status: Status.NotFound, description: 'File not found.' })
  async getMetadata(@Param('id') id: string) {
    this.logger.log(`GET /files/${id}`);
    const result = await this.fileService.findOne(id);

    return { status: Status.Ok, body: result };
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get a short-lived signed download URL for a file' })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: Status.Ok, description: '{ downloadUrl }' })
  @ApiResponse({ status: Status.NotFound, description: 'File not found.' })
  async download(
    @Param('id') id: string,
    @Headers('X-User-Id') userId: string,
  ) {
    if (!userId) throw new BadRequestException('Missing X-User-Id header');
    this.logger.log(`GET /files/${id}/download - userId: ${userId}`);
    const token = await this.fileService.createDownloadToken(userId, id);
    const downloadUrl = `/v1/files/${id}/stream?token=${token}`;
    return { status: Status.Ok, body: { downloadUrl } };
  }

  // Plain NestJS endpoint — outside ts-rest because browsers cannot send Authorization
  // headers on direct navigation. Auth is via capability token in query param instead.
  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream file bytes using a capability token' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiQuery({
    name: 'token',
    description: 'Short-lived signed JWT from /download',
  })
  async stream(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    this.logger.log(`GET /files/${id}/stream`);
    const filePath = await this.fileService.validateTokenAndGetPath(token, id);
    res.sendFile(path.resolve(filePath));
  }

  @Delete(':id')
  @HttpCode(204) // required: controller uses @TsRest({}) class-level only, not @TsRestHandler — NestJS defaults DELETE to 200
  @ApiOperation({ summary: 'Delete a file' })
  @ApiHeader({ name: 'X-User-Id', required: true })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: Status.NoContent, description: 'Deleted.' })
  @ApiResponse({ status: Status.NotFound, description: 'File not found.' })
  async delete(@Param('id') id: string, @Headers('X-User-Id') userId: string) {
    if (!userId) throw new BadRequestException('Missing X-User-Id header');

    this.logger.log(`DELETE /files/${id} - userId: ${userId}`);
    await this.fileService.delete(userId, id);

    return { status: Status.NoContent, body: undefined };
  }

  // EventPattern, not MessagePattern — favorite-service uses emit() (fire-and-forget)
  @EventPattern('favorite.deleted')
  async onFavoriteDeleted(@Payload() data: { favoriteId: string }) {
    this.logger.log(
      `RabbitMQ favorite.deleted - favoriteId: ${data.favoriteId}`,
    );
    await this.fileService.deleteByEntity('favorite', data.favoriteId);
  }
}
