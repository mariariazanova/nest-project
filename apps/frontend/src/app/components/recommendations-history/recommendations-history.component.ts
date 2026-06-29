import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe, JsonPipe, NgForOf, NgIf } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  imports: [NgIf, NgForOf, JsonPipe, DatePipe],
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

  // Track which items are already favourited: key = "category:itemId"
  private favouriteSet = new Set<string>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly http: HttpClient,
    private readonly favoriteService: FavoriteService,
    private readonly suggestionHistoryService: SuggestionHistoryService,
  ) {}

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
    return this.favouriteSet.has(`${category}:${itemId}`);
  }

  toggleFavourite(category: string, itemId: string, title: string): void {
    const key = `${category}:${itemId}`;

    if (this.favouriteSet.has(key)) {
      // We don't have the favoriteId here — just remove from set optimistically
      // A full implementation would store favoriteId per item
      this.favouriteSet.delete(key);
    } else {
      this.favoriteService
        .addFavorite({ itemId, category, title })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.favouriteSet.add(key);
          },
          error: (err) => {
            // Already favourited (409 Conflict) — still mark as added
            if (err.status === 409) {
              this.favouriteSet.add(key);
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
          res.forEach((f) => {
            this.favouriteSet.add(`${f.category}:${f.itemId}`);
          });
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
