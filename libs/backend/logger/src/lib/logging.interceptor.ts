import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { maskSensitiveFields } from './mask-sensitive-fields';

const MAX_RESPONSE_BYTES = 5_120;

function truncateResponse(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  try {
    const serialised = JSON.stringify(data);
    if (serialised.length <= MAX_RESPONSE_BYTES) return data;
    return { _truncated: true, _originalSize: serialised.length };
  } catch {
    return { _truncated: true, _originalSize: -1 };
  }
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(LoggingInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap((responseData: unknown) => {
        const response = context.switchToHttp().getResponse<Response>();
        this.logger.info({
          msg: 'Request completed',
          method: request.method,
          url: request.url,
          statusCode: response.statusCode,
          duration: Date.now() - startTime,
          body: maskSensitiveFields(request.body),
          response: truncateResponse(maskSensitiveFields(responseData)),
        });
      }),
      catchError((err: unknown) => {
        const error = err as { message?: string; status?: number };
        this.logger.error({
          msg: 'Request failed',
          method: request.method,
          url: request.url,
          duration: Date.now() - startTime,
          body: maskSensitiveFields(request.body),
          error: {
            message: error.message ?? 'Unknown error',
            statusCode: error.status ?? 500,
          },
        });
        return throwError(() => err);
      }),
    );
  }
}
