import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { catchError, from, map, Observable, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Suggestion, SuggestionRequest } from '../interfaces/suggestion';
import { createTsRestClient } from '../ts-rest-client';

@Injectable({
  providedIn: 'root',
})
export class SuggestionService {
  suggestions = signal<Suggestion | null>(null);
  isSuggestionLoading = signal<boolean>(false);

  private readonly api = createTsRestClient();
  private readonly destroyRef = inject(DestroyRef);

  setSuggestions(data: Suggestion | null) {
    this.suggestions.set(data);
  }

  setIsSuggestionLoading(isLoading: boolean) {
    this.isSuggestionLoading.set(isLoading);
  }

  loadSuggestions(request: SuggestionRequest): void {
    this.suggestions.set(null);
    this.isSuggestionLoading.set(true);

    this.getSuggestions(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.isSuggestionLoading.set(false);
          return of(null);
        }),
      )
      .subscribe((suggestion) => {
        this.isSuggestionLoading.set(false);
        this.suggestions.set(suggestion);
      });
  }

  getSuggestions(request: SuggestionRequest): Observable<Suggestion> {
    return from(
      this.api.suggestion.getFiltered({
        query: {
          category: request.criteria.category,
          mood: request.criteria.mood,
          genre: request.criteria.genre,
          event: request.criteria.tag,
        },
      }),
    ).pipe(map(({ body }) => body as unknown as Suggestion));
  }
}
