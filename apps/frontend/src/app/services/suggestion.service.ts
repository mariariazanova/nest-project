import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { baseBackEndUrl } from '../constants/urls';
import { Suggestion, SuggestionRequest } from '../interfaces/suggestion';
import { NavigationService } from './navigation.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class SuggestionService {
  suggestions = signal<Suggestion | null>(null);
  isSuggestionLoading = signal<boolean>(false);

  private url = computed(
    () => this.navigationService.getLink('suggestions') ?? `${baseBackEndUrl}suggestion`,
  );

  private readonly http = inject(HttpClient);
  private readonly navigationService = inject(NavigationService);
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
    const params = new HttpParams()
      .set('category', request.criteria.category ?? '')
      .set('mood', request.criteria.mood ?? '')
      .set('genre', request.criteria.genre ?? '')
      .set('event', request.criteria.tag ?? '');

    return this.http.get<{ data: Suggestion }>(this.url(), { params }).pipe(map((res) => res.data));
  }
}
