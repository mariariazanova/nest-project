import { of } from 'rxjs';
import { FavoriteService } from '../../src/app/services/favorite.service';
import { favoritesMock } from './favorite.mock';

class FavoriteServiceMock {
  getFavorites = jasmine.createSpy().and.returnValue(of(favoritesMock));
  addFavorite = jasmine.createSpy().and.returnValue(of(favoritesMock[0]));
  removeFavorite = jasmine.createSpy().and.returnValue(of(void 0));
}

export const favoriteServiceMockProvider = {
  provide: FavoriteService,
  useClass: FavoriteServiceMock,
};
