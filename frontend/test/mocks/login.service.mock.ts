import { signal } from '@angular/core';
import { LoginService } from '../../src/app/services/login.service';

class LoginServiceMock {
  isLoggedIn = signal<boolean>(false);
  setLoggedIn = jasmine.createSpy();
}

export const loginServiceMockProvider = {
  provide: LoginService,
  useClass: LoginServiceMock,
};
