import { Book } from './book';
import { Film } from './film';
import { Game } from './game';
import { Song } from './song';
import { CategoryType } from './category';
import { DataBaseRecommendItem } from './data-base';

export type Item = (Book | Film | Game | Song)[];

export interface Suggestion {
  id: string;
  type: CategoryType;
  items: Item | null;
}

export interface UserChoice {
  mood: string;
  category: string;
  genre: string;
  event: string;
}

export interface SuggestionHistory {
  id: string;
  userId: string;
  criteria: UserChoice;
  suggestions: DataBaseRecommendItem[];
  timestamp: string;
}
