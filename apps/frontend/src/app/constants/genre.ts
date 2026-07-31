import { BookGenre, FilmGenre, GameGenre, SongGenre } from '../enums/genre';
import { Option } from '../interfaces/option';

export const filmGenres: Option[] = [
  { label: 'Przygoda', value: FilmGenre.Adventure },
  { label: 'Animacja', value: FilmGenre.Animation },
  { label: 'Biograficzny', value: FilmGenre.Biography },
  { label: 'Komedia', value: FilmGenre.Comedy },
  { label: 'Kryminał', value: FilmGenre.Crime },
  { label: 'Dokument', value: FilmGenre.Documentary },
  { label: 'Dramat', value: FilmGenre.Drama },
  { label: 'Fantasy', value: FilmGenre.Fantasy },
  { label: 'Horror', value: FilmGenre.Horror },
  { label: 'Romans', value: FilmGenre.Romance },
  { label: 'Sci-Fi', value: FilmGenre.SciFi },
  { label: 'Dreszczowiec', value: FilmGenre.Thriller },
];

export const bookGenres: Option[] = [
  { label: 'Przygoda', value: BookGenre.Adventure },
  { label: 'Biograficzny', value: BookGenre.Biography },
  { label: 'Klasyka', value: BookGenre.Classic },
  { label: 'Kryminał', value: BookGenre.Crime },
  { label: 'Dramat', value: BookGenre.Drama },
  { label: 'Fantasy', value: BookGenre.Fantasy },
  { label: 'Horror', value: BookGenre.Horror },
  { label: 'Motywacyjna', value: BookGenre.Motivational },
  { label: 'Romans', value: BookGenre.Romance },
  { label: 'Sci-Fi', value: BookGenre.SciFi },
  { label: 'Młodzieżowa', value: BookGenre.Youth },
];

export const songGenres = [
  { label: 'Blues', value: SongGenre.Blues },
  { label: 'Klasyczna', value: SongGenre.Classical },
  { label: 'Country', value: SongGenre.Country },
  { label: 'Elektronika', value: SongGenre.Electronic },
  { label: 'Hip-hop', value: SongGenre.HipHop },
  { label: 'Jazz', value: SongGenre.Jazz },
  { label: 'Metal', value: SongGenre.Metal },
  { label: 'Pop', value: SongGenre.Pop },
  { label: 'Reggae', value: SongGenre.Reggae },
  { label: 'Rock', value: SongGenre.Rock },
];

export const gameGenres: Option[] = [
  { label: 'Akcja & Przygodowa', value: GameGenre.Action },
  { label: 'Fighting', value: GameGenre.Fighting },
  { label: 'FPS', value: GameGenre.Fps },
  { label: 'Horror', value: GameGenre.Horror },
  { label: 'Indie', value: GameGenre.Indie },
  { label: 'Wyścigi', value: GameGenre.Racing },
  { label: 'RPG', value: GameGenre.Rpg },
  { label: 'Symulator', value: GameGenre.Simulator },
  { label: 'Sportowa', value: GameGenre.Sports },
  { label: 'Strategia', value: GameGenre.Strategy },
];
