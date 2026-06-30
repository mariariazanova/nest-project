import { Suggestion, SuggestionHistory } from '../../src/app/interfaces/suggestion';
import { Category } from '../../src/app/enums/category';
import { DataBaseRecommendItem } from '../../src/app/interfaces/data-base';
import { userChoiceMock } from './user-choice.mock';

export const suggestionMock: Suggestion = { id: '1', type: Category.FIlM, items: [] };
export const suggestionItemMock: DataBaseRecommendItem = {
  id: '1',
  title: 'Item1',
  mood: ['funny'],
  genre: ['crime'],
  tags: [],
};

export const suggestionHistoryListMock: SuggestionHistory[] = [
  {
    id: 'id',
    userId: 'user-id',
    criteria: userChoiceMock,
    suggestions: [suggestionItemMock],
    timestamp: '',
  },
];
