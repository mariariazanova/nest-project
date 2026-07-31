export interface Film {
  id: string;
  title: string;
  mood: string[];
  genre: string[];
  tags: string[];
  description?: string;
  director?: string;
  year?: number;
}
