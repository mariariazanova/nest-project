export interface Song {
  id: string;
  title: string;
  singer: string;
  mood: string[];
  genre: string[];
  tags: string[];
  description?: string;
  year?: number;
}
