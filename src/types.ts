/** 作品一覧（public/stories/catalog.json） */
export interface Catalog {
  stories: string[];
}

/** エピソード情報（info.json の episodes 内） */
export interface EpisodeInfo {
  id: string;
  title: string;
  file: string;
  order: number;
}

/** 作品情報（public/stories/<作品ID>/info.json） */
export interface StoryInfo {
  id: string;
  title: string;
  author: string;
  cover: string;
  summary: string;
  synopsis: string;
  genre: string;
  originalUrl: string;
  episodes: EpisodeInfo[];
}
