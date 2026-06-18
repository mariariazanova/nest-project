export interface Game {
  id: string;
  title: string;
  mood: string[];
  genre: string[];
  tags: string[];
  description?: string;
  publisher?: string;
  year?: number;
}
