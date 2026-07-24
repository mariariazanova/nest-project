import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  isLoggedIn = signal<boolean>(!!localStorage.getItem('accessToken'));

  setLoggedIn(status: boolean): void {
    this.isLoggedIn.set(status);
  }
}
