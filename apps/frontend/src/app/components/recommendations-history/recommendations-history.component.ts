import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { categoriesOptions, eventTagsOptions, moodTagsOptions } from '../../constants/categories';
import { bookGenres, filmGenres, gameGenres, songGenres } from '../../constants/genre';
import { SuggestionHistory } from '../../interfaces/suggestion';
import { Group } from '../../enums/group';
import { Category } from '../../enums/category';
import { Option } from '../../interfaces/option';
import { FavoriteService } from '../../services/favorite.service';
import { SuggestionHistoryService } from '../../services/suggestion-history.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-recommendations-history',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './recommendations-history.component.html',
  styleUrl: './recommendations-history.component.scss',
})
export class RecommendationsHistoryComponent implements OnInit {
  readonly group = Group;
  readonly map = {
    [Group.MOOD]: moodTagsOptions,
    [Group.CATEGORY]: categoriesOptions,
    [Group.TAG]: eventTagsOptions,
  };

  suggestionHistory = signal<SuggestionHistory[] | null>(null);

  // Maps "category:itemId" -> favoriteId; signal ensures template rerenders on mutation
  private favouriteMap = signal<Map<string, string>>(new Map());
  private readonly destroyRef = inject(DestroyRef);
  private readonly favoriteService = inject(FavoriteService);
  private readonly suggestionHistoryService = inject(SuggestionHistoryService);

  ngOnInit() {
    this.getSuggestionHistory();
    this.loadExistingFavourites();
  }

  getLabel(group: Group, value: string, category?: Category): string {
    const map = {
      [Group.MOOD]: moodTagsOptions,
      [Group.CATEGORY]: categoriesOptions,
      [Group.GENRE]: category ? this.genGenreOptions(category) : [],
      [Group.TAG]: eventTagsOptions,
    };

    return map[group]?.find((el) => el.value === value)?.label ?? '';
  }

  genGenreLabel(genre: string | undefined, category: string): string {
    return genre ? this.getLabel(this.group.GENRE, genre, <Category>category) : '-';
  }

  isFavourite(category: string, itemId: string): boolean {
    return this.favouriteMap().has(`${category}:${itemId}`);
  }

  toggleFavourite(category: string, itemId: string, title: string): void {
    const key = `${category}:${itemId}`;
    const existingId = this.favouriteMap().get(key);

    if (existingId) {
      // Optimistic removal — update UI before API response
      this.favouriteMap.update((m) => {
        const next = new Map(m);
        next.delete(key);
        return next;
      });

      this.favoriteService
        .removeFavorite(existingId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            // Revert on failure
            this.favouriteMap.update((m) => new Map(m).set(key, existingId));
          },
        });
    } else {
      // Optimistic addition — update UI before API response
      this.favouriteMap.update((m) => new Map(m).set(key, '__pending__'));

      this.favoriteService
        .addFavorite({ itemId, category, title })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (fav) => {
            // Replace placeholder with real favoriteId so deletion works
            this.favouriteMap.update((m) => new Map(m).set(key, fav.id));
          },
          error: (err) => {
            if (err.status === 409) {
              // Already exists on server — reload to get the real favoriteId
              this.loadExistingFavourites();
            } else {
              // Revert on failure
              this.favouriteMap.update((m) => {
                const next = new Map(m);
                next.delete(key);
                return next;
              });
            }
          },
        });
    }
  }

  private getSuggestionHistory(): void {
    this.suggestionHistoryService
      .getSuggestionHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        this.suggestionHistory.set(res);
      });
  }

  private loadExistingFavourites(): void {
    this.favoriteService
      .getFavorites()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.favouriteMap.set(new Map(res.map((f) => [`${f.category}:${f.itemId}`, f.id])));
        },
      });
  }

  private genGenreOptions(category: Category): Option[] {
    const map = {
      [Category.FIlM]: filmGenres,
      [Category.BOOK]: bookGenres,
      [Category.SONG]: songGenres,
      [Category.GAME]: gameGenres,
    };

    return map[category] ?? [];
  }
}
