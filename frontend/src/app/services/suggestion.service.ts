import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { baseBackEndUrl } from '../constants/urls';
import { Suggestion, SuggestionRequest } from '../interfaces/suggestion';
import { NavigationService } from './navigation.service';

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

  setSuggestions(data: Suggestion | null) {
    this.suggestions.set(data);
  }

  setIsSuggestionLoading(isLoading: boolean) {
    this.isSuggestionLoading.set(isLoading);
  }

  getSuggestions(request: SuggestionRequest): Observable<Suggestion> {
    const params = new HttpParams()
      .set('category', request.criteria.category ?? '')
      .set('mood', request.criteria.mood ?? '')
      .set('genre', request.criteria.genre ?? '')
      .set('event', request.criteria.tag ?? '');

    console.log(this.navigationService.getLink('suggestions'), this.url());

    return this.http.get<{ data: Suggestion }>(this.url(), { params }).pipe(map((res) => res.data));
  }
}
