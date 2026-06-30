import { of } from 'rxjs';
import { vi } from 'vitest';
import { FavoriteService } from '../../src/app/services/favorite.service';
import { favoritesMock } from './favorite.mock';

class FavoriteServiceMock {
  getFavorites = vi.fn().mockReturnValue(of(favoritesMock));
  addFavorite = vi.fn().mockReturnValue(of(favoritesMock[0]));
  removeFavorite = vi.fn().mockReturnValue(of(void 0));
}

export const favoriteServiceMockProvider = {
  provide: FavoriteService,
  useClass: FavoriteServiceMock,
};
