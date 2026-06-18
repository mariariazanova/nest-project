import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { NavigationService } from '../services/navigation.service';

@Injectable()
export class HateoasInterceptor implements HttpInterceptor {
  constructor(private readonly navigationService: NavigationService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          const body = event.body as any;
          if (body?.links) {
            this.navigationService.setLinks(body.links);
          }
        }
      }),
    );
  }
}
