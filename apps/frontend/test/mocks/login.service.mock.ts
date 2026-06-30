import { signal } from '@angular/core';
import { vi } from 'vitest';
import { LoginService } from '../../src/app/services/login.service';

class LoginServiceMock {
  isLoggedIn = signal<boolean>(false);
  setLoggedIn = vi.fn();
}

export const loginServiceMockProvider = {
  provide: LoginService,
  useClass: LoginServiceMock,
};
