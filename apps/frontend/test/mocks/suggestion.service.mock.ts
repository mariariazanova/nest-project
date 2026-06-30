import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SuggestionService } from '../../src/app/services/suggestion.service';
import { Suggestion } from '../../src/app/interfaces/suggestion';
import { suggestionMock } from './suggestion.mock';

class SuggestionServiceMock {
  suggestions = signal<Suggestion | null>(suggestionMock);
  isSuggestionLoading = signal<boolean>(false);

  setSuggestions = vi.fn();
  getSuggestions = vi.fn().mockReturnValue(of(suggestionMock));
  setIsSuggestionLoading = vi.fn();
  loadSuggestions = vi.fn();
}

export const suggestionServiceMockProvider = {
  provide: SuggestionService,
  useClass: SuggestionServiceMock,
};
