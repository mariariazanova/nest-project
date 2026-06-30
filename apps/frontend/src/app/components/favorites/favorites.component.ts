import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FavoriteService } from '../../services/favorite.service';
import { LoginService } from '../../services/login.service';
import { Favorite } from '../../interfaces/favorites';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
})
export class FavoritesComponent implements OnInit {
  favorites = signal<Favorite[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  readonly categories = [
    { label: 'Wszystkie', value: '' },
    { label: 'Książki', value: 'books' },
    { label: 'Filmy', value: 'films' },
    { label: 'Piosenki', value: 'songs' },
    { label: 'Gry', value: 'games' },
  ];

  selectedCategory = '';

  private readonly destroyRef = inject(DestroyRef);
  private readonly favoriteService = inject(FavoriteService);
  readonly loginService = inject(LoginService);

  ngOnInit(): void {
    if (this.loginService.isLoggedIn()) {
      this.loadFavorites();
    }
  }

  loadFavorites(category?: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.favoriteService
      .getFavorites(category || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.favorites.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          if (err?.status === 404) {
            this.favorites.set([]);
          } else {
            this.errorMessage.set('Nie udało się załadować ulubionych.');
          }
          this.isLoading.set(false);
        },
      });
  }

  onCategoryChange(category: string): void {
    this.selectedCategory = category;
    this.loadFavorites(category);
  }

  removeFavorite(favoriteId: string): void {
    this.favoriteService
      .removeFavorite(favoriteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.favorites.update((list) => list.filter((f) => f.id !== favoriteId));
        },
        error: () => {
          this.errorMessage.set('Nie udało się usunąć z ulubionych.');
        },
      });
  }
}
