import type { AssetsFile, Catalog, CharacterInfo, CharactersFile, EpisodeInfo, StoryInfo } from '../types';
import { storiesUrl, storyFileUrl } from './paths';

/** ファイルが見つからなかったときのエラー（なくてもよいファイルの判定に使う） */
class FileNotFoundError extends Error {}

async function fetchFile(url: string): Promise<Response> {
  // 作品一覧・設定・シナリオは更新されたらすぐ反映されるよう、毎回サーバーに新しいか確認する
  // （変わっていなければ保存済みのものを使うので、通信量はほとんど増えない）
  const res = await fetch(url, { cache: 'no-cache' });
  // 開発サーバーは存在しないファイルに対して index.html を返すため、HTML が返ったら「見つからない」扱いにする
  if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
    throw new FileNotFoundError(`${decodeURI(url)} が見つかりません`);
  }
  return res;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchFile(url);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`${url} の JSON の書き方に誤りがあります`);
  }
}

export interface StoryLoadResult {
  stories: StoryInfo[];
  /** 読み込みに失敗した作品のエラー内容（1作品の失敗で全体を止めない） */
  errors: string[];
}

let storiesCache: Promise<StoryLoadResult> | null = null;

/** catalog.json に登録された作品の info.json をすべて読み込む（2回目以降は前回の結果を使う） */
export function loadStories(): Promise<StoryLoadResult> {
  storiesCache ??= fetchStories().catch((e) => {
    storiesCache = null; // 失敗したときは次回もう一度読み込む
    throw e;
  });
  return storiesCache;
}

/** エピソードを表示順に並べる */
export function sortedEpisodes(story: StoryInfo): EpisodeInfo[] {
  return [...(story.episodes ?? [])].sort((a, b) => a.order - b.order);
}

async function fetchStories(): Promise<StoryLoadResult> {
  const catalog = await fetchJson<Catalog>(storiesUrl('catalog.json'));
  if (!Array.isArray(catalog.stories)) {
    throw new Error('catalog.json に "stories" の一覧がありません');
  }
  const results = await Promise.allSettled(
    catalog.stories.map((id) => fetchJson<StoryInfo>(storyFileUrl(id, 'info.json'))),
  );
  const stories: StoryInfo[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') stories.push({ ...r.value, id: catalog.stories[i] });
    else errors.push(`${catalog.stories[i]}: ${(r.reason as Error).message}`);
  });
  return { stories, errors };
}

export interface StoryResources {
  characters: CharacterInfo[];
  assets: AssetsFile;
  errors: string[];
}

/** なくてもよい JSON を読み込む。ファイルがなければ fallback を返す（書き方の誤りはエラーにする） */
function fetchOptionalJson<T>(url: string, fallback: T): Promise<T> {
  return fetchJson<T>(url).catch((e) => {
    if (e instanceof FileNotFoundError) return fallback;
    throw e;
  });
}

/**
 * 作品のキャラクター設定と素材設定を読み込む。
 * どちらもなくてよい（モノローグだけのシナリオなど）。読み込めなくても空の設定で続行する
 */
export async function loadStoryResources(storyId: string): Promise<StoryResources> {
  const [chars, assets] = await Promise.allSettled([
    fetchOptionalJson<CharactersFile>(storyFileUrl(storyId, 'characters.json'), { characters: [] }),
    fetchOptionalJson<AssetsFile>(storyFileUrl(storyId, 'assets.json'), {}),
  ]);
  const errors: string[] = [];
  if (chars.status === 'rejected') errors.push((chars.reason as Error).message);
  if (assets.status === 'rejected') errors.push((assets.reason as Error).message);
  return {
    characters: chars.status === 'fulfilled' ? (chars.value.characters ?? []) : [],
    assets: assets.status === 'fulfilled' ? assets.value : {},
    errors,
  };
}

/** シナリオ（.txt）を読み込む */
export async function loadScenarioText(storyId: string, file: string): Promise<string> {
  const res = await fetchFile(storyFileUrl(storyId, `scenarios/${file}`));
  return res.text();
}
