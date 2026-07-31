import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { SuggestionService } from './suggestion.service';
import { SuggestionRequest } from '../interfaces/suggestion';
import { baseBackEndUrl } from '../constants/urls';
import { suggestionMock } from '../../../test/mocks/suggestion.mock';

describe('SuggestionService', () => {
  let service: SuggestionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SuggestionService],
    });

    service = TestBed.inject(SuggestionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set suggestions signal', () => {
    service.setSuggestions(suggestionMock);

    expect(service.suggestions()).toEqual(suggestionMock);
  });

  it('should call getSuggestions and return data', async () => {
    const mockRequest: SuggestionRequest = {
      userId: 'id',
      criteria: {
        mood: 'funny',
        category: 'film',
        genre: 'comedy',
        tag: undefined,
      },
    };

    const resultPromise = firstValueFrom(service.getSuggestions(mockRequest));

    const req = httpMock.expectOne(
      `${baseBackEndUrl}suggestion?category=film&mood=funny&genre=comedy`,
    );

    expect(req.request.method).toBe('GET');
    req.flush({ data: suggestionMock });

    const result = await resultPromise;
    expect(result).toEqual(suggestionMock);
  });
});
