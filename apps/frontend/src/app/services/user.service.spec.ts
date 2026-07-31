import { TestBed } from '@angular/core/testing';

import { AuthResponse, UserService } from './user.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { baseBackEndUrl } from '../constants/urls';
import { userWithoutIdMock, userWithoutPasswordMock } from '../../../test/mocks/user.mock';

const input = userWithoutIdMock;
const authResponseMock: AuthResponse = {
  user: userWithoutPasswordMock,
  accessToken: 'mock-access-token',
};

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call login and return user data', () => {
    service.login(input).subscribe((res) => {
      expect(res).toEqual(authResponseMock);
    });

    const req = httpMock.expectOne(`${baseBackEndUrl}auth/sessions`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);

    req.flush({ data: authResponseMock });
  });

  it('should call createUser and return user data', () => {
    service.createUser(input).subscribe((res) => {
      expect(res).toEqual(authResponseMock);
    });

    const req = httpMock.expectOne(`${baseBackEndUrl}auth/users`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);

    req.flush({ data: authResponseMock });
  });
});
