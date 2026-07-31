import { inject, Injectable } from '@angular/core';
import { forkJoin, from, map, Observable, of, switchMap } from 'rxjs';
import { Favorite, FavoriteWithFiles } from '../interfaces/favorites';
import { createTsRestClient } from '../ts-rest-client';
import { FileService } from './file.service';

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
  private readonly fileService = inject(FileService);

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

  loadFavoritesWithFiles(category?: string): Observable<FavoriteWithFiles[]> {
    return this.getFavorites(category).pipe(
      switchMap((favorites) =>
        favorites.length === 0
          ? of([])
          : forkJoin(
              favorites.map((fav) =>
                this.fileService
                  .getByEntity('favorite', fav.id)
                  .pipe(map((files) => ({ ...fav, files }))),
              ),
            ),
      ),
    );
  }
}
