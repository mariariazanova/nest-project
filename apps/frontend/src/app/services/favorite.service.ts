import { computed, inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { baseBackEndUrl } from '../constants/urls';
import { Favorite } from '../interfaces/favorites';
import { NavigationService } from './navigation.service';

export interface AddFavoriteRequest {
  itemId: string;
  category: string;
  title?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  private url = computed(
    () => this.navigationService.getLink('favorites') ?? `${baseBackEndUrl}favorite`,
  );

  private readonly http = inject(HttpClient);
  private readonly navigationService = inject(NavigationService);

  getFavorites(category?: string): Observable<Favorite[]> {
    let params = new HttpParams();
    if (category) {
      params = params.set('category', category);
    }
    return this.http.get<{ data: Favorite[] }>(this.url(), { params }).pipe(map((res) => res.data));
  }

  addFavorite(request: AddFavoriteRequest): Observable<Favorite> {
    return this.http.post<{ data: Favorite }>(this.url(), request).pipe(map((res) => res.data));
  }

  removeFavorite(favoriteId: string): Observable<void> {
    return this.http.delete<void>(`${this.url()}/${favoriteId}`);
  }

  checkIsFavorite(category: string, itemId: string): Observable<{ isFavorite: boolean }> {
    return this.http
      .get<{ data: { isFavorite: boolean } }>(`${this.url()}/check/${category}/${itemId}`)
      .pipe(map((res) => res.data));
  }
}
