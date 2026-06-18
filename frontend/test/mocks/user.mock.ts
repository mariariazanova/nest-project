import { UserWithoutId, UserWithoutPassword } from '../../src/app/interfaces/user';

export const userWithoutIdMock: UserWithoutId = { username: 'alice', password: 'password' };
export const userWithoutPasswordMock: UserWithoutPassword = { id: 'u2', username: 'alice' };
