import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthResponse, UserService } from '../../src/app/services/user.service';
import { userWithoutPasswordMock } from './user.mock';

const authResponseMock: AuthResponse = {
  user: userWithoutPasswordMock,
  accessToken: 'mock-access-token',
};

class UserServiceMock {
  userId = 'user-id';

  createUser = vi.fn().mockReturnValue(of(authResponseMock));
  login = vi.fn().mockReturnValue(of(authResponseMock));
  logout = vi.fn().mockReturnValue(of(void 0));
}

export const userServiceMockProvider = {
  provide: UserService,
  useClass: UserServiceMock,
};
