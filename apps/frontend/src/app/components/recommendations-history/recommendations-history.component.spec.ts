import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { RecommendationsHistoryComponent } from './recommendations-history.component';
import { userServiceMockProvider } from '../../../../test/mocks/user.service.mock';
import { baseBackEndUrl } from '../../constants/urls';
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
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendationsHistoryComponent, HttpClientTestingModule],
      providers: [userServiceMockProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendationsHistoryComponent);
    httpMock = TestBed.inject(HttpTestingController);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch suggestion history and set signal', () => {
    fixture.detectChanges();

    const historyReq = httpMock.expectOne(`${baseBackEndUrl}history`);

    expect(historyReq.request.method).toBe('GET');
    historyReq.flush({ data: suggestionHistoryListMock });

    const favoriteReq = httpMock.expectOne(`${baseBackEndUrl}favorite`);

    expect(favoriteReq.request.method).toBe('GET');
    favoriteReq.flush({ data: [] });

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
    fixture.detectChanges();
    httpMock.expectOne(`${baseBackEndUrl}history`).flush({ data: [] });
    httpMock.expectOne(`${baseBackEndUrl}favorite`).flush({ data: [favoriteMock] });

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);
    expect(component.isFavourite('BOOK', 'item-2')).toBe(false);
  });

  it('#toggleFavourite should optimistically add star before API responds', () => {
    fixture.detectChanges();
    httpMock.expectOne(`${baseBackEndUrl}history`).flush({ data: [] });
    httpMock.expectOne(`${baseBackEndUrl}favorite`).flush({ data: [] });

    component.toggleFavourite('BOOK', 'item-1', 'My Book');

    // Immediately visible before HTTP response
    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);

    const addReq = httpMock.expectOne(`${baseBackEndUrl}favorite`);
    expect(addReq.request.method).toBe('POST');
    addReq.flush({ data: { ...favoriteMock, id: 'fav-new' } });

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);
  });

  it('#toggleFavourite should revert optimistic add on non-409 error', () => {
    fixture.detectChanges();
    httpMock.expectOne(`${baseBackEndUrl}history`).flush({ data: [] });
    httpMock.expectOne(`${baseBackEndUrl}favorite`).flush({ data: [] });

    component.toggleFavourite('BOOK', 'item-1', 'My Book');

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);

    httpMock
      .expectOne(`${baseBackEndUrl}favorite`)
      .flush('Error', { status: 500, statusText: 'Internal Server Error' });

    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);
  });

  it('#toggleFavourite should optimistically remove star and call DELETE', () => {
    fixture.detectChanges();
    httpMock.expectOne(`${baseBackEndUrl}history`).flush({ data: [] });
    httpMock.expectOne(`${baseBackEndUrl}favorite`).flush({ data: [favoriteMock] });

    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);

    component.toggleFavourite('BOOK', 'item-1', 'My Book');

    // Immediately removed before HTTP response
    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);

    const deleteReq = httpMock.expectOne(`${baseBackEndUrl}favorite/fav-1`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);

    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);
  });

  it('#toggleFavourite should revert optimistic removal on DELETE error', () => {
    fixture.detectChanges();
    httpMock.expectOne(`${baseBackEndUrl}history`).flush({ data: [] });
    httpMock.expectOne(`${baseBackEndUrl}favorite`).flush({ data: [favoriteMock] });

    component.toggleFavourite('BOOK', 'item-1', 'My Book');

    expect(component.isFavourite('BOOK', 'item-1')).toBe(false);

    httpMock
      .expectOne(`${baseBackEndUrl}favorite/fav-1`)
      .flush('Error', { status: 500, statusText: 'Internal Server Error' });

    // Reverted
    expect(component.isFavourite('BOOK', 'item-1')).toBe(true);
  });
});
