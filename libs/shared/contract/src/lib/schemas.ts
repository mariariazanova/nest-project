import { z } from 'zod';

export const ErrorSchema = z.object({ message: z.string() });

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
});

// passthrough: TypeORM entities include relation objects (moods, genres, events)
// that vary by media type and are not part of the contract surface
export const ItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
  })
  .passthrough();

export const FavoriteCategoryEnum = z.enum([
  'books',
  'films',
  'games',
  'songs',
]);

export const FavoriteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  itemId: z.string(),
  category: FavoriteCategoryEnum,
  title: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

export const FileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedBy: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

// Mongoose documents use _id; criteria stores single string values from query params
export const HistoryEntrySchema = z.object({
  _id: z.string(),
  userId: z.string(),
  criteria: z.object({
    category: z.string().optional(),
    mood: z.string().optional(),
    genre: z.string().optional(),
    event: z.string().optional(),
  }),
  suggestions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      category: z.string(),
    }),
  ),
  timestamp: z.union([z.string(), z.date()]),
});
