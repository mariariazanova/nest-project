import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ErrorSchema, FileSchema } from './schemas';
import { Status } from './status';

const c = initContract();

export const fileContract = c.router({
  upload: {
    method: 'POST',
    path: '/files',
    contentType: 'multipart/form-data',
    body: z.object({
      file: z.any(),
      entityType: z.string().optional(),
      entityId: z.string().uuid().optional(),
    }),
    responses: {
      [Status.Created]: FileSchema,
      [Status.BadRequest]: ErrorSchema,
    },
    summary: 'Upload a file, optionally associating it with an entity',
  },
  getByEntity: {
    method: 'GET',
    path: '/files',
    query: z.object({
      entityType: z.string(),
      entityId: z.string().uuid(),
    }),
    responses: {
      [Status.Ok]: z.array(FileSchema),
    },
    summary: 'Get all files associated with a given entity',
  },
  getMetadata: {
    method: 'GET',
    path: '/files/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      [Status.Ok]: FileSchema,
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Get metadata for a single file',
  },
  download: {
    method: 'GET',
    path: '/files/:id/download',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      [Status.Ok]: z.object({ downloadUrl: z.string() }),
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Get a short-lived signed download URL for a file',
  },
  delete: {
    method: 'DELETE',
    path: '/files/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: c.noBody(),
    responses: {
      [Status.NoContent]: c.noBody(),
      [Status.NotFound]: ErrorSchema,
    },
    summary: 'Delete a file',
  },
});
