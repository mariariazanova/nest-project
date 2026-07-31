import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';

import { RecommendationsHistoryComponent } from './recommendations-history.component';
import { userServiceMockProvider } from '../../../../test/mocks/user.service.mock';
import { SuggestionHistoryService } from '../../services/suggestion-history.service';
import { FavoriteService } from '../../services/favorite.service';
import { suggestionHistoryListMock } from '../../../../test/mocks/suggestion.mock';
import { Group } from '../../enums/group';
import { Favorite } from '../../interfaces/favorites';

const favoriteMock: Favorite = {
  id: 'fav-1',
  userId: 'user-1',
  itemId: 'item-1',
  category: 'BOOK',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('RecommendationHistoryComponent', () => {
  let component: RecommendationsHistoryComponent;
  let fixture: ComponentFixture<RecommendationsHistoryComponent>;

  let getSuggestionHistory: ReturnType<typeof vi.fn>;
  let getFavorites: ReturnType<typeof vi.fn>;
  let addFavorite: ReturnType<typeof vi.fn>;
  let removeFavorite: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getSuggestionHistory = vi.fn().mockReturnValue(of([]));
    getFavorites = vi.fn().mockReturnValue(of([]));
    addFavorite = vi.fn();
    removeFavorite = vi.fn();

    await TestBed.configureTestingModule({
      imports: [RecommendationsHistoryComponent],
      providers: [
        userServiceMockProvider,
        {
          provide: SuggestionHistoryService,
          useValue: { getSuggestionHistory },
        },
        {
          provide: FavoriteService,
          useValue: { getFavorites, addFavorite, removeFavorite },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendationsHistoryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch suggestion history and set signal', () => {
    getSuggestionHistory.mockReturnValue(of(suggestionHistoryListMock));
    fixture.detectChanges();
    expect(component.suggestionHistory()).toEqual(suggestionHistoryListMock);
  });

  it('#getLabel should return mood label', () => {
    expect(component.getLabel(Group.MOOD, 'funny')).toBe('Zabawny');
  });

  it('#genGenreLabel should return genre label', () => {
    expect(component.genGenreLabel('fantasy', 'books')).toBe('Fantasy');
  });

  it('#genGenreLabel should return "-" if genre is undefined', () => {
    expect(component.genGenreLabel(undefined, 'books')).toBe('-');
  });

  it('#isFavourite should return false before favorites load', () => {
    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);
  });

  it('#isFavourite should return true after favorites load from server', () => {
    getFavorites.mockReturnValue(of([favoriteMock]));
    fixture.detectChanges();

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);
    expect(component.isFavourite('BOOK', 'item-2')).toBe(false);
  });

  it('#toggleFavourite should optimistically add star before API responds', () => {
    const addSubject = new Subject<Favorite>();
    addFavorite.mockReturnValue(addSubject.asObservable());
    fixture.detectChanges();

    component.toggleFavourite('BOOK', 'item-1', 'My Book');

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);

    addSubject.next({ ...favoriteMock, id: 'fav-new' });
    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);
  });

  it('#toggleFavourite should revert optimistic add on non-409 error', () => {
    const addSubject = new Subject<Favorite>();
    addFavorite.mockReturnValue(addSubject.asObservable());
    fixture.detectChanges();

    component.toggleFavourite('BOOK', 'item-1', 'My Book');
    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);

    addSubject.error({ status: 500 });
    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);
  });

  it('#toggleFavourite should optimistically remove star and call DELETE', () => {
    const removeSubject = new Subject<unknown>();
    getFavorites.mockReturnValue(of([favoriteMock]));
    removeFavorite.mockReturnValue(removeSubject.asObservable());
    fixture.detectChanges();

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);

    component.toggleFavourite('BOOK', 'item-1', 'My Book');

    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);
    expect(removeFavorite).toHaveBeenCalledWith('fav-1');

    removeSubject.next(null);
    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);
  });

  it('#toggleFavourite should revert optimistic removal on DELETE error', () => {
    const removeSubject = new Subject<unknown>();
    getFavorites.mockReturnValue(of([favoriteMock]));
    removeFavorite.mockReturnValue(removeSubject.asObservable());
    fixture.detectChanges();

    component.toggleFavourite('BOOK', 'item-1', 'My Book');
    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);

    removeSubject.error({ status: 500 });
    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);
  });
});
