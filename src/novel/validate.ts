// シナリオで使っている名前が、作品の設定ファイルに登録されているかを調べる。
// アプリと公開前チェックの両方から使う。

import type { AssetsFile, CharacterInfo } from '../types';
import type { ScenarioCommand } from './engine';
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
    if (cmd.type === 'character' && cmd.name !== null && !findCharacter(characters, cmd.name)) {
      errors.push({ line: cmd.line, message: `キャラ「${cmd.name}」は characters.json に登録されていません` });
    }
    if (cmd.type === 'background' && !assets.backgrounds?.[cmd.name]) {
      errors.push({ line: cmd.line, message: `背景「${cmd.name}」は assets.json の backgrounds に登録されていません` });
    }
    if (cmd.type === 'still' && cmd.name !== null && !assets.stills?.[cmd.name]) {
      errors.push({ line: cmd.line, message: `スチル「${cmd.name}」は assets.json の stills に登録されていません` });
    }
  }
  return errors;
}
