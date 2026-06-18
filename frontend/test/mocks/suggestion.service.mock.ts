import { of } from 'rxjs';
import { signal } from '@angular/core';
import { SuggestionService } from '../../src/app/services/suggestion.service';
import { Suggestion } from '../../src/app/interfaces/suggestion';
import { suggestionMock } from './suggestion.mock';

class SuggestionServiceMock {
  suggestions = signal<Suggestion | null>(suggestionMock);
  isSuggestionLoading = signal<boolean>(false);

  setSuggestions = jasmine.createSpy();
  getSuggestions = jasmine.createSpy().and.returnValue(of(suggestionMock));
  setIsSuggestionLoading = jasmine.createSpy();
}

export const suggestionServiceMockProvider = {
  provide: SuggestionService,
  useClass: SuggestionServiceMock,
};
