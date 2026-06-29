import { Book } from './book';
import { Game } from './game';
import { Film } from './film';
import { Song } from './song';

export interface Favorites {
  books: Book[];
  films: Film[];
  games: Game[];
  songs: Song[];
}

export interface FavoritesResponse {
  books: Book[];
  films: Film[];
  games: Game[];
  songs: Song[];
}
