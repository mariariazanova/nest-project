export interface Song {
  id: string;
  title: string;
  author: string;
  mood: string[];
  genre: string[];
  tags: string[];
  description?: string;
  year?: number;
}
