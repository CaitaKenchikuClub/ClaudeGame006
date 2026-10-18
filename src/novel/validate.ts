// シナリオで使っている名前が、作品の設定ファイルに登録されているかを調べる。
// アプリと公開前チェックの両方から使う。

import type { AssetsFile, CharacterInfo } from '../types';
import type { NovelState, ScenarioCommand } from './engine';
import type { ScenarioError } from './parser';

export function findCharacter(characters: CharacterInfo[], name: string): CharacterInfo | undefined {
  return characters.find((c) => c.name === name || c.id === name);
}

export function validateScenario(
  commands: ScenarioCommand[],
  characters: CharacterInfo[],
  assets: AssetsFile,
): ScenarioError[] {
  const errors: ScenarioError[] = [];
  for (const cmd of commands) {
    if (cmd.type === 'character' && cmd.name !== null) {
      const info = findCharacter(characters, cmd.name);
      if (!info) {
        errors.push({ line: cmd.line, message: `キャラ「${cmd.name}」は characters.json に登録されていません` });
      } else if (cmd.full && !info.full) {
        errors.push({ line: cmd.line, message: `キャラ「${info.name}」の全身の画像（full）が characters.json に登録されていません` });
      }
    }
    if (cmd.type === 'background' && !assets.backgrounds?.[cmd.name]) {
      errors.push({ line: cmd.line, message: `背景「${cmd.name}」は assets.json の backgrounds に登録されていません` });
    }
    if (cmd.type === 'still' && cmd.name !== null && !assets.stills?.[cmd.name]) {
      errors.push({ line: cmd.line, message: `スチル「${cmd.name}」は assets.json の stills に登録されていません` });
    }
    if (cmd.type === 'expression') {
      const info = findCharacter(characters, cmd.character);
      if (!info) {
        errors.push({ line: cmd.line, message: `キャラ「${cmd.character}」は characters.json に登録されていません` });
      } else if (cmd.expression !== null && !info.expressions?.[cmd.expression]) {
        errors.push({
          line: cmd.line,
          message: `表情「${cmd.expression}」は characters.json の「${info.name}」の expressions に登録されていません`,
        });
      }
    }
    if (cmd.type === 'bgm' && cmd.name !== null && !assets.bgm?.[cmd.name]) {
      errors.push({ line: cmd.line, message: `BGM「${cmd.name}」は assets.json の bgm に登録されていません` });
    }
    if (cmd.type === 'se' && !assets.se?.[cmd.name]) {
      errors.push({ line: cmd.line, message: `効果音「${cmd.name}」は assets.json の se に登録されていません` });
    }
  }
  return errors;
}

/** 立ち絵の大きさの初期値（画面の高さに対する%）。バストアップは腰まで描いた画像を想定 */
export const DEFAULT_HEIGHT = 75;
export const DEFAULT_FULL_HEIGHT = 85;

export interface CharacterDisplay {
  /** characters フォルダ内の画像ファイル名（登録がなければ undefined） */
  image: string | undefined;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * 画面に出す立ち絵の画像と大きさ・位置を決める。
 * full が true（「全身」指定）か、ふだんの画像がないキャラは全身の立ち絵を使う。表情はふだんの立ち絵にだけ反映する
 */
export function characterDisplay(info: CharacterInfo, full: boolean, expression: string | undefined): CharacterDisplay {
  const fullBody = typeof info.full === 'string' ? { image: info.full } : info.full;
  if (fullBody && (full || !info.image)) {
    return {
      image: fullBody.image,
      height: fullBody.height ?? DEFAULT_FULL_HEIGHT,
      offsetX: fullBody.offsetX ?? 0,
      offsetY: fullBody.offsetY ?? 0,
    };
  }
  return {
    image: (expression && info.expressions?.[expression]) || info.image,
    height: info.height ?? DEFAULT_HEIGHT,
    offsetX: info.offsetX ?? 0,
    offsetY: info.offsetY ?? 0,
  };
}

/** 全身の立ち絵の画像ファイル名（登録がなければ undefined） */
export function fullBodyImage(info: CharacterInfo): string | undefined {
  return typeof info.full === 'string' ? info.full : info.full?.image;
}

/** ある場面で、その名前のキャラをどの画像・大きさで出すか（表情と「全身」指定を反映） */
export function displayInState(state: NovelState, name: string, info: CharacterInfo): CharacterDisplay {
  const expression = state.expressions[info.name] ?? state.expressions[info.id];
  return characterDisplay(info, !!state.fullBody[name], expression);
}
