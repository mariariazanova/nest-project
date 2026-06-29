import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { RecommendationsHistoryComponent } from './recommendations-history.component';
import { userServiceMockProvider } from '../../../../test/mocks/user.service.mock';
import { baseBackEndUrl } from '../../constants/urls';
import { suggestionHistoryListMock } from '../../../../test/mocks/suggestion.mock';
import { Group } from '../../enums/group';

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
});
