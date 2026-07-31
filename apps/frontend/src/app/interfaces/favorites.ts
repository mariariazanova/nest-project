// export interface Favorites {
//   books: Book[];
//   films: Film[];
//   games: Game[];
//   songs: Song[];
// }

export interface Favorite {
  id: string;
  userId: string;
  itemId: string;
  category: string;
  title?: string;
  createdAt: string;
}

export interface FileItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedBy: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface FavoriteWithFiles extends Favorite {
  files: FileItem[];
}

// export interface FavoritesResponse {
//   books: Book[];
//   films: Film[];
//   games: Game[];
//   songs: Song[];
// }
