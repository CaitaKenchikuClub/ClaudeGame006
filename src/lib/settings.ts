import { useSyncExternalStore } from 'react';
import { loadData, saveData } from './storage';

export type Speed = 'slow' | 'normal' | 'fast';

export interface Settings {
  /** 文字の表示速度（instant は一瞬で全文表示） */
  textSpeed: Speed | 'instant';
  /** オート再生で次へ進むまでの速さ */
  autoSpeed: Speed;
  /** 0〜100 */
  bgmVolume: number;
  /** 0〜100 */
  seVolume: number;
  muted: boolean;
}

const DEFAULTS: Settings = { textSpeed: 'normal', autoSpeed: 'normal', bgmVolume: 70, seVolume: 80, muted: false };

/** 1文字を表示する間隔（ミリ秒） */
export const CHAR_INTERVAL_MS: Record<Settings['textSpeed'], number> = { slow: 70, normal: 40, fast: 20, instant: 0 };

/** オート再生で、全文表示後に次へ進むまでの待ち時間（ミリ秒）。文字数が多いほど長く待つ */
export function autoWaitMs(speed: Speed, length: number): number {
  const base = { slow: 2500, normal: 1500, fast: 800 }[speed];
  const perChar = { slow: 60, normal: 40, fast: 20 }[speed];
  return base + length * perChar;
}

let current: Settings = loadData('settings', DEFAULTS);
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  saveData('settings', current);
  listeners.forEach((l) => l());
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 設定を読み取り、変更されたら再描画する */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}
