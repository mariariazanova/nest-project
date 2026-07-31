import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FavoriteService } from '../../services/favorite.service';
import { FileService } from '../../services/file.service';
import { LoginService } from '../../services/login.service';
import { SocketService } from '../../services/socket.service';
import { FavoriteWithFiles, FileItem } from '../../interfaces/favorites';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.scss',
})
export class FavoritesComponent implements OnInit {
  favorites = signal<FavoriteWithFiles[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  uploadProgress = signal<Record<string, number>>({});

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
  private readonly fileService = inject(FileService);
  private readonly socketService = inject(SocketService);
  readonly loginService = inject(LoginService);

  private pendingUploadFavoriteId: string | null = null;

  ngOnInit(): void {
    if (this.loginService.isLoggedIn()) {
      this.loadFavorites();
    }

    this.socketService
      .on<{ fileId: string; percent: number }>('upload-progress')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ percent }) => {
        if (this.pendingUploadFavoriteId) {
          const favoriteId = this.pendingUploadFavoriteId;
          this.uploadProgress.update((p) => ({ ...p, [favoriteId]: percent }));
        }
      });
  }

  loadFavorites(category?: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.favoriteService
      .loadFavoritesWithFiles(category || undefined)
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
          this.favorites.update((list) =>
            list.filter((f) => f.id !== favoriteId),
          );
        },
        error: () => {
          this.errorMessage.set('Nie udało się usunąć z ulubionych.');
        },
      });
  }

  onFileSelected(event: Event, favoriteId: string): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.pendingUploadFavoriteId = favoriteId;
    this.uploadProgress.update((p) => ({ ...p, [favoriteId]: 0 }));

    this.fileService
      .upload(file, 'favorite', favoriteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uploaded: FileItem) => {
          this.pendingUploadFavoriteId = null;
          this.favorites.update((list) =>
            list.map((fav) =>
              fav.id === favoriteId
                ? { ...fav, files: [...fav.files, uploaded] }
                : fav,
            ),
          );
          this.uploadProgress.update((p) => {
            const next = { ...p };
            delete next[favoriteId];
            return next;
          });
          (event.target as HTMLInputElement).value = '';
        },
        error: () => {
          this.pendingUploadFavoriteId = null;
          this.errorMessage.set('Nie udało się przesłać pliku.');
          this.uploadProgress.update((p) => {
            const next = { ...p };
            delete next[favoriteId];
            return next;
          });
        },
      });
  }

  downloadFile(fileId: string, fileName: string): void {
    this.fileService
      .download(fileId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((downloadUrl) => {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        a.click();
      });
  }

  deleteFile(fileId: string, favoriteId: string): void {
    this.fileService
      .delete(fileId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.favorites.update((list) =>
            list.map((fav) =>
              fav.id === favoriteId
                ? { ...fav, files: fav.files.filter((f) => f.id !== fileId) }
                : fav,
            ),
          );
        },
        error: () => {
          this.errorMessage.set('Nie udało się usunąć pliku.');
        },
      });
  }

  getCategoryLabel(category: string): string {
    return this.categories.find((c) => c.value === category)?.label ?? category;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
