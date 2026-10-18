// 途中再開の位置と読了記録を端末内に保存する。
import { loadData, saveData } from './storage';

interface Progress {
  /** "作品ID/エピソードID" → 再開位置（シナリオ内のコマンド番号） */
  resume: Record<string, number>;
  /** "作品ID/エピソードID" → 読了日時（ISO 形式） */
  completed: Record<string, string>;
}

let progress: Progress = loadData<Progress>('progress', { resume: {}, completed: {} });

const keyOf = (storyId: string, episodeId: string) => `${storyId}/${episodeId}`;

export function getResumeIndex(storyId: string, episodeId: string): number | undefined {
  return progress.resume[keyOf(storyId, episodeId)];
}

export function saveResumeIndex(storyId: string, episodeId: string, index: number): void {
  progress = { ...progress, resume: { ...progress.resume, [keyOf(storyId, episodeId)]: index } };
  saveData('progress', progress);
}

export function clearResume(storyId: string, episodeId: string): void {
  const resume = { ...progress.resume };
  delete resume[keyOf(storyId, episodeId)];
  progress = { ...progress, resume };
  saveData('progress', progress);
}

export function markCompleted(storyId: string, episodeId: string): void {
  progress = { ...progress, completed: { ...progress.completed, [keyOf(storyId, episodeId)]: new Date().toISOString() } };
  saveData('progress', progress);
}

export function isCompleted(storyId: string, episodeId: string): boolean {
  return keyOf(storyId, episodeId) in progress.completed;
}
