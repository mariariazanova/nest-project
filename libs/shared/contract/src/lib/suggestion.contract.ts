import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, ItemSchema } from './schemas';
import { Status } from './status';

// c is the ts-rest DSL builder — same convention as z for Zod. Used only to call c.router(), c.noBody(), etc.
const c = initContract();

const SuggestionResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  items: z.array(ItemSchema).nullable(),
});

export const suggestionContract = c.router({
  getFiltered: {
    method: 'GET',
    path: '/suggestion',
    query: z.object({
      category: z.string().optional(),
      mood: z.string().optional(),
      genre: z.string().optional(),
      event: z.string().optional(),
    }),
    responses: {
      [Status.Ok]: SuggestionResponseSchema,
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Get filtered suggestions by category, mood, genre, and event',
  },
  getOne: {
    method: 'GET',
    path: '/suggestion/:category/:id',
    pathParams: z.object({
      category: z.string(),
      id: z.string(),
    }),
    responses: {
      [Status.Ok]: ItemSchema,
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Get a single suggestion item by category and ID',
  },
});
