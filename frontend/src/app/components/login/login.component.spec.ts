import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginComponent } from './login.component';
import { userServiceMockProvider } from '../../../../test/mocks/user.service.mock';
import { loginServiceMockProvider } from '../../../../test/mocks/login.service.mock';
import { userWithoutIdMock, userWithoutPasswordMock } from '../../../../test/mocks/user.mock';
import { UserService } from '../../services/user.service';
import { requiredError } from '../../constants/error';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let userServiceMock: UserService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [userServiceMockProvider, loginServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    userServiceMock = TestBed.inject(UserService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize loginForm with correct controls and default values', () => {
    const form = component.loginForm;

    expect(form).toBeTruthy();
    expect(form.contains('isNewAccountCreated')).toBeTrue();
    expect(form.contains('userName')).toBeTrue();
    expect(form.contains('password')).toBeTrue();
    expect(form.get('isNewAccountCreated')?.value).toBeFalse();
    expect(form.get('userName')?.value).toBeNull();
    expect(form.get('password')?.value).toBeNull();
  });

  it('#isNewAccountCreated() should return isNewAccountCreated form control value', () => {
    component.loginForm.setValue({
      userName: 'alice',
      password: 'password',
      isNewAccountCreated: true,
    });

    expect(component.isNewAccountCreated).toBeTrue();
  });

  it('#onLogin should emit login event for existing user', () => {
    spyOn(component.login, 'emit');

    component.loginForm.setValue({
      userName: 'alice',
      password: 'password',
      isNewAccountCreated: false,
    });

    component.onLogin();

    expect(userServiceMock.login).toHaveBeenCalledWith(userWithoutIdMock);
    expect(component.login.emit).toHaveBeenCalledWith(userWithoutPasswordMock);
  });

  it('#onLogin should emit login event for new user', () => {
    spyOn(component.login, 'emit');

    component.loginForm.setValue({
      userName: 'alice',
      password: 'password',
      isNewAccountCreated: true,
    });

    component.onLogin();

    expect(userServiceMock.createUser).toHaveBeenCalledWith(userWithoutIdMock);
    expect(component.login.emit).toHaveBeenCalledWith(userWithoutPasswordMock);
  });

  it('#onCancel should emit cancel event', () => {
    spyOn(component.cancel, 'emit');

    component.onCancel();

    expect(component.cancel.emit).toHaveBeenCalled();
  });

  it('#getControlErrorMessages should return error message when control exists', () => {
    expect(component.getErrorMessage('userName')).toBe(requiredError);
  });

  it('#getControlErrorMessages should return null if control does not exist', () => {
    expect(component.getErrorMessage('nonexistentControl')).toBeNull();
  });
});
