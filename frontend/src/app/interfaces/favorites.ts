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

// export interface FavoritesResponse {
//   books: Book[];
//   films: Film[];
//   games: Game[];
//   songs: Song[];
// }
