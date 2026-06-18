export interface DataBaseRecommendItem {
  id: string;
  title: string;
  mood: string[];
  genre: string[];
  description?: string;
  year?: number;
  author?: string;
  publisher?: string;
  director?: string;
  singer?: string;
  tags: string[];
}
