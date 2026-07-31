import { Injectable, inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Status } from '@suggestify/shared/contract';
import { UserService } from '../services/user.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private readonly userService = inject(UserService);
  private readonly notification = inject(NotificationService);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          if (err.status === Status.Unauthorized) {
            // Skip when there is no session — a login-attempt 401 is handled by the login component.
            if (this.userService.accessToken) {
              this.userService.clearSession();
              this.notification.show(
                'Your session has expired. Please log in again.',
              );
            }
          } else if (err.status === Status.Forbidden) {
            this.notification.show('Access denied.');
          } else if (err.status === Status.TooManyRequests) {
            this.notification.show('Too many requests — please wait a moment.');
          } else if (err.status >= Status.InternalServerError) {
            this.notification.show('Something went wrong. Please try again.');
          } else if (
            err.status !== Status.BadRequest &&
            err.status !== Status.NotFound
          ) {
            this.notification.show('Request failed. Please try again.');
          }
        }
        return throwError(() => err);
      }),
    );
  }
}
