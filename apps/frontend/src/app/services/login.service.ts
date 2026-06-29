import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  isLoggedIn = signal<boolean>(false);

  setLoggedIn(status: boolean): void {
    this.isLoggedIn.set(status);
  }
}
