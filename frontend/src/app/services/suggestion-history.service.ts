import { computed, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { baseBackEndUrl } from '../constants/urls';
import { SuggestionHistory } from '../interfaces/suggestion';
import { NavigationService } from './navigation.service';

@Injectable({
  providedIn: 'root',
})
export class SuggestionHistoryService {
  private url = computed(
    () => this.navigationService.getLink('history') ?? `${baseBackEndUrl}history`,
  );

  private readonly http = inject(HttpClient);
  private readonly navigationService = inject(NavigationService);

  getSuggestionHistory(): Observable<SuggestionHistory[]> {
    return this.http.get<{ data: SuggestionHistory[] }>(this.url()).pipe(map((res) => res.data));
  }
}
