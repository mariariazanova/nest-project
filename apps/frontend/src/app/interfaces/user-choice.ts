import { Group } from '../enums/group';

export type UserChoiceGroup = Group.MOOD | Group.CATEGORY | Group.GENRE | Group.TAG;

export interface UserChoice {
  mood: string | undefined;
  category: string | undefined;
  genre: string | undefined;
  tag: string | undefined; // maps to 'event' when sent to backend
}
