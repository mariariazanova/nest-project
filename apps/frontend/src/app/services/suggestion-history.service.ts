import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { SuggestionHistory } from '../interfaces/suggestion';
import { createTsRestClient } from '../ts-rest-client';

@Injectable({
  providedIn: 'root',
})
export class SuggestionHistoryService {
  private readonly api = createTsRestClient();

  getSuggestionHistory(): Observable<SuggestionHistory[]> {
    return from(this.api.history.getAll({})).pipe(
      map(({ body }) => body as unknown as SuggestionHistory[]),
    );
  }
}
