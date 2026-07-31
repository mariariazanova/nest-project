import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, HistoryEntrySchema } from './schemas';
import { Status } from './status';

// c is the ts-rest DSL builder — same convention as z for Zod. Used only to call c.router(), c.noBody(), etc.
const c = initContract();

export const historyContract = c.router({
  getAll: {
    method: 'GET',
    path: '/history',
    responses: {
      [Status.Ok]: z.array(HistoryEntrySchema),
    },
    summary: 'Get all suggestion history entries for the authenticated user',
  },
  getStats: {
    method: 'GET',
    path: '/history/stats',
    responses: {
      [Status.Ok]: z.record(z.string(), z.unknown()),
    },
    summary: 'Get aggregated suggestion statistics for the user',
  },
  getById: {
    method: 'GET',
    path: '/history/:id',
    pathParams: z.object({ id: z.string() }),
    responses: {
      [Status.Ok]: HistoryEntrySchema,
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Get a single history entry by ID',
  },
});
