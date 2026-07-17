import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Favorite } from '../interfaces/favorites';
import { createTsRestClient } from '../ts-rest-client';

export interface AddFavoriteRequest {
  itemId: string;
  category: string;
  title?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoriteService {
  private readonly api = createTsRestClient();

  getFavorites(category?: string): Observable<Favorite[]> {
    return from(
      this.api.favorite.getAll({ query: { category: category as any } }),
    ).pipe(map(({ body }) => body as unknown as Favorite[]));
  }

  addFavorite(request: AddFavoriteRequest): Observable<Favorite> {
    return from(this.api.favorite.add({ body: request as any })).pipe(
      map((res) => {
        if (res.status >= 400) throw { status: res.status };
        return res.body as unknown as Favorite;
      }),
    );
  }

  removeFavorite(favoriteId: string): Observable<unknown> {
    return from(this.api.favorite.remove({ params: { id: favoriteId } })).pipe(
      map((res) => {
        if (res.status >= 400) throw { status: res.status };
        return res;
      }),
    );
  }

  checkIsFavorite(
    category: string,
    itemId: string,
  ): Observable<{ isFavorite: boolean }> {
    return from(
      this.api.favorite.checkFavorite({ params: { category, itemId } }),
    ).pipe(map(({ body }) => body as { isFavorite: boolean }));
  }
}
