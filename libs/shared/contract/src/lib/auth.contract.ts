import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { AuthResponseSchema, ErrorSchema, UserSchema } from './schemas';
import { Status } from './status';

// c is the ts-rest DSL builder — same convention as z for Zod. Used only to call c.router(), c.noBody(), etc.
const c = initContract();

export const authContract = c.router({
  register: {
    method: 'POST',
    path: '/auth/users',
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(6),
    }),
    responses: {
      [Status.Created]: AuthResponseSchema,
      [Status.BadRequest]: ErrorSchema,
    },
    summary: 'Register a new user',
  },
  login: {
    method: 'POST',
    path: '/auth/sessions',
    body: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }),
    responses: {
      [Status.Ok]: AuthResponseSchema,
      [Status.Unauthorized]: ErrorSchema,
    },
    summary: 'Login and obtain a JWT access token',
  },
  logout: {
    method: 'DELETE',
    path: '/auth/sessions',
    body: c.noBody(),
    responses: {
      [Status.Ok]: z.object({ message: z.string(), statusCode: z.number() }),
      [Status.Unauthorized]: ErrorSchema,
    },
    summary: 'Logout and invalidate the current JWT token',
  },
  getProfile: {
    method: 'GET',
    path: '/auth/users/me',
    responses: {
      [Status.Ok]: UserSchema,
      [Status.Unauthorized]: ErrorSchema,
    },
    summary: 'Get the authenticated user profile',
  },
});
