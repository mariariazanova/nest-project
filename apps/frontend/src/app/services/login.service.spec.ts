import { TestBed } from '@angular/core/testing';

import { LoginService } from './login.service';

describe('LoginService', () => {
  let service: LoginService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoginService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default isLoggedIn = false', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should set isLoggedIn to true', () => {
    service.setLoggedIn(true);

    expect(service.isLoggedIn()).toBeTrue();
  });

  it('should set isLoggedIn to false', () => {
    service.setLoggedIn(true);
    service.setLoggedIn(false);

    expect(service.isLoggedIn()).toBeFalse();
  });
});
