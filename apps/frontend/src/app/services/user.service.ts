import { Injectable } from '@angular/core';
import { from } from 'rxjs';
import { map, tap } from 'rxjs';
import { UserWithoutPassword } from '../interfaces/user';
import { Status } from '@suggestify/shared/contract';
import { createTsRestClient } from '../ts-rest-client';

export interface AuthResponse {
  user: UserWithoutPassword;
  accessToken: string;
}

const TOKEN_KEY = 'accessToken';
const USER_ID_KEY = 'userId';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  userId: string | null = localStorage.getItem(USER_ID_KEY);
  accessToken: string | null = localStorage.getItem(TOKEN_KEY);

  private readonly api = createTsRestClient();

  login(user: { username: string; password: string }) {
    return from(this.api.auth.login({ body: user })).pipe(
      map((result) => this.handleAuthResponse(result)),
    );
  }

  createUser(user: { username: string; password: string }) {
    return from(this.api.auth.register({ body: user })).pipe(
      map((result) => this.handleAuthResponse(result)),
    );
  }

  private handleAuthResponse(result: {
    status: number;
    body: unknown;
  }): AuthResponse {
    if (result.status !== Status.Ok && result.status !== Status.Created) {
      const rawError = result.body as any;
      // Unwrap gateway's { data: {...}, links: {...} } wrapper so er?.error?.message resolves
      const errorBody = rawError?.data ?? rawError;
      throw { error: errorBody };
    }
    const data: AuthResponse = result.body as AuthResponse;
    this.accessToken = data.accessToken;
    this.userId = data.user.id;
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(USER_ID_KEY, data.user.id);
    return data;
  }

  logout() {
    return from(this.api.auth.logout({})).pipe(tap(() => this.clearSession()));
  }

  clearSession(): void {
    this.accessToken = null;
    this.userId = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  }
}
