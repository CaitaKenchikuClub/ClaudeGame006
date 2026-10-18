import type { Catalog, StoryInfo } from '../types';
import { storiesUrl, storyFileUrl } from './paths';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} を読み込めませんでした（${res.status}）`);
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

/** catalog.json に登録された作品の info.json をすべて読み込む */
export async function loadStories(): Promise<StoryLoadResult> {
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
