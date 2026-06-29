import { computed, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { UserWithoutId, UserWithoutPassword } from '../interfaces/user';
import { baseBackEndUrl } from '../constants/urls';
import { NavigationService } from './navigation.service';

export interface AuthResponse {
  user: UserWithoutPassword;
  accessToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  userId: string | null = null;
  accessToken: string | null = null;

  private url = computed(
    () => this.navigationService.getLink('sessions') ?? `${baseBackEndUrl}auth/sessions`,
  );
  private usersUrl = computed(
    () => this.navigationService.getLink('users') ?? `${baseBackEndUrl}auth/users`,
  );

  private readonly http = inject(HttpClient);
  private readonly navigationService = inject(NavigationService);

  login(user: UserWithoutId): Observable<AuthResponse> {
    return this.http.post<{ data: AuthResponse }>(this.url(), user).pipe(
      map((res) => res.data),
      tap((res) => {
        this.accessToken = res.accessToken;
        this.userId = res.user.id;
      }),
    );
  }

  createUser(user: UserWithoutId): Observable<AuthResponse> {
    return this.http.post<{ data: AuthResponse }>(this.usersUrl(), user).pipe(
      map((res) => res.data),
      tap((res) => {
        this.accessToken = res.accessToken;
        this.userId = res.user.id;
      }),
    );
  }

  logout(): Observable<unknown> {
    return this.http.delete(this.url(), {}).pipe(
      tap(() => {
        this.accessToken = null;
        this.userId = null;
      }),
    );
  }
}
