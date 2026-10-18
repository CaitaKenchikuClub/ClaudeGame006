// 画像・音声の先読み。
// 開始時は最初の場面の画像だけを待ち、残りは再生しながら登場順に裏で読み込む。
import type { AssetsFile, CharacterInfo } from '../types';
import type { NovelState, Position, ScenarioCommand } from '../novel/engine';
import { characterImage, findCharacter } from '../novel/validate';
import { storyFileUrl } from './paths';

/** URL → 読み込みの Promise（同じ画像を二重に読み込まない） */
const loading = new Map<string, Promise<void>>();
/** 表示できる状態になった画像。参照を持ち続けて、ブラウザのメモリから消えにくくする */
const ready = new Map<string, HTMLImageElement>();
/** 読み込みが終わった画像（失敗も含む。失敗した画像を何度も待たないため） */
const settled = new Set<string>();

/** 画像を1枚読み込んで表示できる状態にする。失敗しても止めない */
export function preloadImage(url: string): Promise<void> {
  let p = loading.get(url);
  if (!p) {
    const img = new Image();
    img.src = url;
    p = img
      .decode()
      .then(
        () => void ready.set(url, img),
        () => console.warn(`画像を読み込めませんでした: ${url}`),
      )
      .finally(() => settled.add(url));
    loading.set(url, p);
  }
  return p;
}

/** 読み込みが終わっている（失敗も含む）か */
export function isImageSettled(url: string): boolean {
  return settled.has(url);
}

/** 画像の読み込みを待つ。timeoutMs を過ぎたら待つのをやめる */
export async function waitForImages(urls: string[], timeoutMs: number): Promise<void> {
  await Promise.race([Promise.all(urls.map(preloadImage)), new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** 画像を順番に裏で読み込む（同時に読み込むのは concurrency 枚まで） */
export function preloadInBackground(urls: string[], concurrency = 3): void {
  const queue = [...urls];
  const next = (): Promise<void> | undefined => {
    const url = queue.shift();
    return url === undefined ? undefined : preloadImage(url).then(next);
  };
  for (let i = 0; i < concurrency; i++) next();
}

/** 音声は再生を待たせず、裏で取得してブラウザのキャッシュに入れておく */
export function prefetchAudio(urls: string[]): void {
  for (const url of urls) fetch(url).catch(() => {});
}

interface EpisodeContext {
  storyId: string;
  characters: CharacterInfo[];
  assets: AssetsFile;
}

const POSITIONS: Position[] = ['left', 'center', 'right'];

/** ある場面で画面に表示される画像の URL */
export function imagesForState(state: NovelState, { storyId, characters, assets }: EpisodeContext): string[] {
  const urls: string[] = [];
  const bg = state.background ? assets.backgrounds?.[state.background] : undefined;
  if (bg) urls.push(storyFileUrl(storyId, `backgrounds/${bg}`));
  if (state.still !== null) {
    const still = assets.stills?.[state.still];
    if (still) urls.push(storyFileUrl(storyId, `stills/${still}`));
    return urls; // スチル表示中は立ち絵を出さない
  }
  for (const pos of POSITIONS) {
    const name = state.characters[pos];
    const info = name ? findCharacter(characters, name) : undefined;
    if (info) {
      const image = characterImage(info, state.expressions[info.name] ?? state.expressions[info.id]);
      urls.push(storyFileUrl(storyId, `characters/${image}`));
    }
  }
  return urls;
}

/** シナリオで使う画像（登場順）と音声の URL を集める（重複なし） */
export function collectEpisodeFiles(
  commands: ScenarioCommand[],
  { storyId, characters, assets }: EpisodeContext,
): { images: string[]; audio: string[] } {
  const images = new Set<string>();
  const audio = new Set<string>();
  const add = (set: Set<string>, folder: string, file: string | undefined) => {
    if (file) set.add(storyFileUrl(storyId, `${folder}/${file}`));
  };
  for (const cmd of commands) {
    if (cmd.type === 'background') add(images, 'backgrounds', assets.backgrounds?.[cmd.name]);
    if (cmd.type === 'still' && cmd.name) add(images, 'stills', assets.stills?.[cmd.name]);
    if (cmd.type === 'character' && cmd.name) {
      const info = findCharacter(characters, cmd.name);
      if (info) add(images, 'characters', info.image);
    }
    if (cmd.type === 'expression' && cmd.expression) {
      const info = findCharacter(characters, cmd.character);
      if (info) add(images, 'characters', characterImage(info, cmd.expression));
    }
    if (cmd.type === 'bgm' && cmd.name) add(audio, 'audio', assets.bgm?.[cmd.name]);
    if (cmd.type === 'se') add(audio, 'audio', assets.se?.[cmd.name]);
  }
  return { images: [...images], audio: [...audio] };
}
