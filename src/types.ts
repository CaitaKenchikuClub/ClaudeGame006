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

/** キャラクター情報（public/stories/<作品ID>/characters.json の characters 内） */
/** 全身の立ち絵（ファイル名だけでも、大きさ・位置を付けた形でも書ける） */
export type FullBodyImage = string | { image: string; height?: number; offsetX?: number; offsetY?: number };

export interface CharacterInfo {
  id: string;
  /** シナリオで指定する表示名 */
  name: string;
  /** ふだんの立ち絵（バストアップ）の画像ファイル名（characters フォルダ内）。全身だけのキャラは省略可 */
  image?: string;
  /** 全身の立ち絵（#キャラ画像 キャラ名 全身 で表示）。省略可 */
  full?: FullBodyImage;
  /** 表情名 → characters フォルダ内の画像ファイル名（省略可。ふだんの立ち絵に使う） */
  expressions?: Record<string, string>;
  /** 画面の高さに対する立ち絵の高さ（%）。省略時は 75（全身だけのキャラは 85） */
  height?: number;
  /** 右方向へのずらし量（画面の幅に対する%）。マイナスで左へ。省略時は 0 */
  offsetX?: number;
  /** 下方向へのずらし量（画面の高さに対する%）。マイナスで上へ。省略時は 0 */
  offsetY?: number;
}

export interface CharactersFile {
  characters: CharacterInfo[];
}

/** 素材の名前とファイル名の対応（public/stories/<作品ID>/assets.json） */
export interface AssetsFile {
  backgrounds?: Record<string, string>;
  stills?: Record<string, string>;
  /** audio フォルダ内のファイル */
  bgm?: Record<string, string>;
  /** audio フォルダ内のファイル */
  se?: Record<string, string>;
}
