import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FavoritesComponent } from './favorites.component';
import { loginServiceMockProvider } from '../../../../test/mocks/login.service.mock';
import { favoriteServiceMockProvider } from '../../../../test/mocks/favorite.service.mock';
import { FavoriteService } from '../../services/favorite.service';
import { LoginService } from '../../services/login.service';
import { favoritesMock } from '../../../../test/mocks/favorite.mock';

describe('FavoritesComponent', () => {
  let component: FavoritesComponent;
  let fixture: ComponentFixture<FavoritesComponent>;
  let favoriteService: FavoriteService;
  let loginService: LoginService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FavoritesComponent],
      providers: [favoriteServiceMockProvider, loginServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(FavoritesComponent);
    favoriteService = TestBed.inject(FavoriteService);
    loginService = TestBed.inject(LoginService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('initial state', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should start with an empty favorites list', () => {
      expect(component.favorites()).toEqual([]);
    });

    it('should start with isLoading false', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should start with no error message', () => {
      expect(component.errorMessage()).toBeNull();
    });

    it('should expose the correct categories', () => {
      expect(component.categories.length).toBe(5);
      expect(component.categories[0]).toEqual({
        label: 'Wszystkie',
        value: '',
      });
      expect(component.categories[4]).toEqual({ label: 'Gry', value: 'games' });
    });
  });

  describe('ngOnInit', () => {
    it('should call loadFavorites when user is logged in', () => {
      loginService.isLoggedIn.set(true);
      vi.spyOn(component, 'loadFavorites');
      component.ngOnInit();

      expect(component.loadFavorites).toHaveBeenCalled();
    });

    it('should not call loadFavorites when user is not logged in', () => {
      loginService.isLoggedIn.set(false);
      vi.spyOn(component, 'loadFavorites');
      component.ngOnInit();

      expect(component.loadFavorites).not.toHaveBeenCalled();
    });
  });

  describe('loadFavorites', () => {
    it('should populate favorites on success', () => {
      component.loadFavorites();

      expect(component.favorites()).toEqual(favoritesMock);
    });

    it('should clear errorMessage before fetching', () => {
      component.errorMessage.set('previous error');
      component.loadFavorites();

      expect(component.errorMessage()).toBeNull();
    });

    it('should call loadFavoritesWithFiles without argument when no category given', () => {
      component.loadFavorites();

      expect(favoriteService.loadFavoritesWithFiles).toHaveBeenCalledWith(
        undefined,
      );
    });

    it('should call loadFavoritesWithFiles without argument for empty string category', () => {
      component.loadFavorites('');

      expect(favoriteService.loadFavoritesWithFiles).toHaveBeenCalledWith(
        undefined,
      );
    });

    it('should forward a non-empty category to loadFavoritesWithFiles', () => {
      component.loadFavorites('books');

      expect(favoriteService.loadFavoritesWithFiles).toHaveBeenCalledWith(
        'books',
      );
    });

    it('should set errorMessage and stop loading on non-404 error', () => {
      vi.mocked(favoriteService.loadFavoritesWithFiles).mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadFavorites();

      expect(component.errorMessage()).toBe(
        'Nie udało się załadować ulubionych.',
      );
      expect(component.isLoading()).toBe(false);
    });

    it('should not update favorites on non-404 error', () => {
      component.favorites.set(favoritesMock);
      vi.mocked(favoriteService.loadFavoritesWithFiles).mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadFavorites();

      expect(component.favorites()).toEqual(favoritesMock);
    });

    it('should treat 404 as empty list with no error message', () => {
      component.favorites.set(favoritesMock);
      vi.mocked(favoriteService.loadFavoritesWithFiles).mockReturnValue(
        throwError(() => ({ status: 404 })),
      );
      component.loadFavorites();

      expect(component.favorites()).toEqual([]);
      expect(component.errorMessage()).toBeNull();
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('onCategoryChange', () => {
    it('should update selectedCategory', () => {
      component.onCategoryChange('films');

      expect(component.selectedCategory).toBe('films');
    });

    it('should call loadFavorites with the new category', () => {
      vi.spyOn(component, 'loadFavorites');
      component.onCategoryChange('songs');

      expect(component.loadFavorites).toHaveBeenCalledWith('songs');
    });

    it('should handle empty string category (reset to all)', () => {
      component.selectedCategory = 'books';
      vi.spyOn(component, 'loadFavorites');
      component.onCategoryChange('');

      expect(component.selectedCategory).toBe('');
      expect(component.loadFavorites).toHaveBeenCalledWith('');
    });
  });

  describe('removeFavorite', () => {
    beforeEach(() => {
      component.favorites.set([...favoritesMock]);
    });

    it('should remove the favorite with the given id on success', () => {
      vi.mocked(favoriteService.removeFavorite).mockReturnValue(of(void 0));
      component.removeFavorite('1');

      expect(component.favorites().find((f) => f.id === '1')).toBeUndefined();
    });

    it('should keep other favorites after removal', () => {
      vi.mocked(favoriteService.removeFavorite).mockReturnValue(of(void 0));
      component.removeFavorite('1');

      expect(component.favorites().length).toBe(1);
      expect(component.favorites()[0].id).toBe('2');
    });

    it('should call removeFavorite service with the correct id', () => {
      vi.mocked(favoriteService.removeFavorite).mockReturnValue(of(void 0));
      component.removeFavorite('2');

      expect(favoriteService.removeFavorite).toHaveBeenCalledWith('2');
    });

    it('should set errorMessage on removal error', () => {
      vi.mocked(favoriteService.removeFavorite).mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.removeFavorite('1');

      expect(component.errorMessage()).toBe(
        'Nie udało się usunąć z ulubionych.',
      );
    });

    it('should NOT modify favorites list on removal error', () => {
      vi.mocked(favoriteService.removeFavorite).mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.removeFavorite('1');

      expect(component.favorites().length).toBe(2);
    });
  });
});
