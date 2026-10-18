// BGM と効果音の再生。設定（音量・ミュート）の変更はすぐに反映する。
import { getSettings, subscribeSettings } from '../lib/settings';

let bgm: HTMLAudioElement | null = null;
let bgmSrc: string | null = null;

function applyVolume(audio: HTMLAudioElement, kind: 'bgm' | 'se') {
  const s = getSettings();
  audio.volume = (kind === 'bgm' ? s.bgmVolume : s.seVolume) / 100;
  // iPhone では volume が効かないため、ミュートは muted で行う
  audio.muted = s.muted;
}

function warnOnError(audio: HTMLAudioElement) {
  audio.addEventListener('error', () => console.warn(`音声を読み込めませんでした: ${audio.src}`));
}

/** BGM を切り替える。同じ曲なら続けて流す。null で止める */
export function playBgm(src: string | null): void {
  if (bgm && src === bgmSrc) return;
  stopBgm();
  if (!src) return;
  bgm = new Audio(src);
  bgmSrc = src;
  bgm.loop = true;
  warnOnError(bgm);
  applyVolume(bgm, 'bgm');
  // 自動再生が許可されていないときは、次のタップで resumeAudio() から再生する
  bgm.play().catch(() => {});
}

export function stopBgm(): void {
  if (!bgm) return;
  bgm.pause();
  bgm.removeAttribute('src');
  bgm = null;
  bgmSrc = null;
}

export function playSe(src: string): void {
  const se = new Audio(src);
  warnOnError(se);
  applyVolume(se, 'se');
  se.play().catch(() => {});
}

/** ユーザーがタップしたときに呼ぶ。ブラウザに止められていた BGM を再生し直す */
export function resumeAudio(): void {
  if (bgm?.paused) bgm.play().catch(() => {});
}

subscribeSettings(() => {
  if (bgm) applyVolume(bgm, 'bgm');
});
