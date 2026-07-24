import { FavoriteWithFiles } from '../../src/app/interfaces/favorites';

export const favoritesMock: FavoriteWithFiles[] = [
  {
    id: '1',
    userId: 'user-id',
    itemId: '1',
    title: 'Book One',
    category: 'books',
    createdAt: 'date',
    files: [],
  },
  {
    id: '2',
    userId: 'user-id',
    itemId: '2',
    title: 'Book Two',
    category: 'books',
    createdAt: 'date',
    files: [],
  },
];
