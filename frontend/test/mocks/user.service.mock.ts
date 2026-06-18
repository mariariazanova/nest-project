import { of } from 'rxjs';
import { AuthResponse, UserService } from '../../src/app/services/user.service';
import { userWithoutPasswordMock } from './user.mock';

const authResponseMock: AuthResponse = {
  user: userWithoutPasswordMock,
  accessToken: 'mock-access-token',
};

class UserServiceMock {
  userId = 'user-id';

  createUser = jasmine.createSpy().and.returnValue(of(authResponseMock));
  login = jasmine.createSpy().and.returnValue(of(authResponseMock));
  logout = jasmine.createSpy().and.returnValue(of(void 0));
}

export const userServiceMockProvider = {
  provide: UserService,
  useClass: UserServiceMock,
};
