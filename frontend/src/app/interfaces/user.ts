export interface User {
  id: string;
  username: string;
  password: string;
}

export type UserWithoutId = Omit<User, 'id'>;
export type UserWithoutPassword = Omit<User, 'password'>;
