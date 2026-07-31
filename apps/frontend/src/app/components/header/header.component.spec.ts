import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockInstance } from 'vitest';

import { HeaderComponent } from './header.component';
import { LoginService } from '../../services/login.service';
import { Router } from '@angular/router';
import { loginServiceMockProvider } from '../../../../test/mocks/login.service.mock';
import { userServiceMockProvider } from '../../../../test/mocks/user.service.mock';
import { userWithoutPasswordMock } from '../../../../test/mocks/user.mock';
import { RouterTestingModule } from '@angular/router/testing';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let loginServiceMock: LoginService;
  let routerMock: Router;
  let navigateSpy: MockInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent, RouterTestingModule],
      providers: [loginServiceMockProvider, userServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    loginServiceMock = TestBed.inject(LoginService);
    routerMock = TestBed.inject(Router);
    navigateSpy = vi.spyOn(routerMock, 'navigate').mockResolvedValue(true);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute isLoggedIn from LoginService', () => {
    expect(component.isLoggedIn()).toBe(false);
  });

  it('#openLoginModal should open and #closeLoginModal should close the login modal', () => {
    component.openLoginModal();
    expect(component.isLoginModalOpen).toBe(true);

    component.closeLoginModal();
    expect(component.isLoginModalOpen).toBe(false);
  });

  it('#onLogin should set userName and call setLoggedIn(true) on login', () => {
    component.onLogin(userWithoutPasswordMock);

    expect(loginServiceMock.setLoggedIn).toHaveBeenCalledWith(true);
    expect(component.userName()).toBe('alice');
    expect(component.isLoginModalOpen).toBe(false);
  });

  it('#onLogin should call setLoggedIn(false) and close modal when no user is passed', () => {
    component.onLogin(undefined);

    expect(loginServiceMock.setLoggedIn).toHaveBeenCalledWith(false);
    expect(component.userName()).toBeNull();
    expect(component.isLoginModalOpen).toBe(false);
  });

  it('#onLogout should logout and navigate to root', () => {
    component.onLogout();

    expect(loginServiceMock.setLoggedIn).toHaveBeenCalledWith(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
