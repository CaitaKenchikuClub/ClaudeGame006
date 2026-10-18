// エピソードで使う画像・音声を、再生前に読み込んでおく。
import type { AssetsFile, CharacterInfo } from '../types';
import type { ScenarioCommand } from '../novel/engine';
import { characterImage, findCharacter } from '../novel/validate';
import { storyFileUrl } from './paths';

/** 読み込み済みの画像。参照を持ち続けて、ブラウザのメモリから消えにくくする */
const loadedImages = new Map<string, HTMLImageElement>();

/** シナリオで使う画像と音声の URL を集める（重複なし） */
export function collectEpisodeFiles(
  storyId: string,
  commands: ScenarioCommand[],
  characters: CharacterInfo[],
  assets: AssetsFile,
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

/** 画像を1枚読み込んで表示できる状態にする。失敗しても止めない */
function preloadImage(url: string): Promise<void> {
  if (loadedImages.has(url)) return Promise.resolve();
  const img = new Image();
  img.src = url;
  return img.decode().then(
    () => void loadedImages.set(url, img),
    () => console.warn(`画像を読み込めませんでした: ${url}`),
  );
}

/**
 * 画像をすべて読み込む。onProgress で進み具合（読み込んだ数）を知らせる。
 * 回線が遅いときに待たせすぎないよう、timeoutMs を過ぎたら残りは裏で読み込みながら先へ進む。
 */
export async function preloadImages(
  urls: string[],
  onProgress: (done: number) => void,
  timeoutMs = 15000,
): Promise<void> {
  let done = 0;
  const all = Promise.all(
    urls.map((url) =>
      preloadImage(url).then(() => {
        done++;
        onProgress(done);
      }),
    ),
  );
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** 音声は再生を待たせず、裏で取得してブラウザのキャッシュに入れておく */
export function prefetchAudio(urls: string[]): void {
  for (const url of urls) fetch(url).catch(() => {});
}
