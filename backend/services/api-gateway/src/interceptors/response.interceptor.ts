import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    console.log('request', request);

    return next.handle().pipe(
      map((data) => {
        console.log('response', data);
        if (data && data.data !== undefined) {
          return data;
        }

        return { data, links: { self: request.url } };
      }),
    );
  }
}
