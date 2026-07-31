import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, FavoriteCategoryEnum, FavoriteSchema } from './schemas';
import { Status } from './status';

// c is the ts-rest DSL builder — same convention as z for Zod. Used only to call c.router(), c.noBody(), etc.
const c = initContract();

export const favoriteContract = c.router({
  getAll: {
    method: 'GET',
    path: '/favorite',
    query: z.object({
      category: FavoriteCategoryEnum.optional(),
    }),
    responses: {
      [Status.Ok]: z.array(FavoriteSchema),
      [Status.BadRequest]: ErrorSchema,
    },
    summary: 'Get all favorites for the authenticated user',
  },
  getById: {
    method: 'GET',
    path: '/favorite/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      [Status.Ok]: FavoriteSchema,
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Get a single favorite by ID',
  },
  checkFavorite: {
    method: 'GET',
    path: '/favorite/check/:category/:itemId',
    pathParams: z.object({
      category: z.string(),
      itemId: z.string(),
    }),
    responses: {
      [Status.Ok]: z.object({ isFavorite: z.boolean() }),
    },
    summary: "Check if a specific item is in the user's favorites",
  },
  add: {
    method: 'POST',
    path: '/favorite',
    body: z.object({
      itemId: z.string(),
      category: FavoriteCategoryEnum,
      title: z.string().optional(),
    }),
    responses: {
      [Status.Created]: FavoriteSchema,
      [Status.BadRequest]: ErrorSchema,
    },
    summary: 'Add an item to favorites',
  },
  remove: {
    method: 'DELETE',
    path: '/favorite/:id',
    pathParams: z.object({ id: z.string() }),
    body: c.noBody(),
    responses: {
      [Status.NoContent]: c.noBody(),
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Remove a favorite by ID',
  },
});
