import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserService } from '../services/user.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly userService = inject(UserService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.userService.accessToken;
    const userId = this.userService.userId;

    let headers = req.headers;

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    if (userId) {
      headers = headers.set('X-User-Id', userId);
    }

    return next.handle(req.clone({ headers }));
  }
}
