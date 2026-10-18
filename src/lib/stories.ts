import type { AssetsFile, Catalog, CharacterInfo, CharactersFile, EpisodeInfo, StoryInfo } from '../types';
import { storiesUrl, storyFileUrl } from './paths';

async function fetchFile(url: string): Promise<Response> {
  const res = await fetch(url);
  // 開発サーバーは存在しないファイルに対して index.html を返すため、HTML が返ったら「見つからない」扱いにする
  if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`${decodeURI(url)} が見つかりません`);
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

/** 作品のキャラクター設定と素材設定を読み込む（失敗しても空の設定で続行する） */
export async function loadStoryResources(storyId: string): Promise<StoryResources> {
  const [chars, assets] = await Promise.allSettled([
    fetchJson<CharactersFile>(storyFileUrl(storyId, 'characters.json')),
    fetchJson<AssetsFile>(storyFileUrl(storyId, 'assets.json')),
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
