// GitHub Pages のサブディレクトリ（/ClaudeGame006/）でも正しく読み込めるよう、
// public 配下のファイルは必ずこの関数を通して URL を作る。
const BASE = import.meta.env.BASE_URL;

/** public/stories 配下のファイルの URL */
export function storiesUrl(path: string): string {
  return `${BASE}stories/${path}`;
}

/** 作品フォルダ内のファイルの URL */
export function storyFileUrl(storyId: string, path: string): string {
  return storiesUrl(`${storyId}/${path}`);
}
