import { UserChoice } from './user-choice';
import { CategoryType } from './category';
import { DataBaseRecommendItem } from './data-base';

export interface Suggestion {
  id: string;
  type: CategoryType;
  items: DataBaseRecommendItem[] | null;
}

export interface SuggestionRequest {
  userId: string;
  criteria: UserChoice;
}

export interface SuggestionHistory extends SuggestionRequest {
  id: string;
  userId: string;
  suggestions: DataBaseRecommendItem[];
  timestamp: string;
}
