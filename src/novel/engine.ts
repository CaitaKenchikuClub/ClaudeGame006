// ノベルゲームの進行処理。画面表示とは切り離し、状態の計算だけを行う。

export type Position = 'left' | 'center' | 'right';

export type ScenarioCommand = { /** シナリオファイルの行番号（エラー表示用） */ line: number } & (
  | { type: 'background'; name: string }
  /** name が null ならその位置の立ち絵を消す */
  | { type: 'character'; position: Position; name: string | null }
  | { type: 'hideAllCharacters' }
  /** name が null ならスチルを消す */
  | { type: 'still'; name: string | null }
  /** speaker が null ならモノローグ（地の文） */
  | { type: 'text'; speaker: string | null; text: string }
  /** expression が null なら通常の画像に戻す */
  | { type: 'expression'; character: string; expression: string | null }
  /** name が null なら BGM を止める */
  | { type: 'bgm'; name: string | null }
  | { type: 'se'; name: string }
  | { type: 'end' }
);

export interface NovelState {
  /** 次に実行するコマンドの番号 */
  index: number;
  background: string | null;
  characters: Record<Position, string | null>;
  still: string | null;
  /** キャラ名 → 表情名 */
  expressions: Record<string, string>;
  bgm: string | null;
  /** 直前の step で鳴らす効果音 */
  se: string[];
  speaker: string | null;
  text: string;
  ended: boolean;
}

export const initialNovelState: NovelState = {
  index: 0,
  background: null,
  characters: { left: null, center: null, right: null },
  still: null,
  expressions: {},
  bgm: null,
  se: [],
  speaker: null,
  text: '',
  ended: false,
};

/** 次の文章（またはシナリオの終わり）までコマンドを実行した状態を返す */
export function step(commands: ScenarioCommand[], state: NovelState): NovelState {
  const s: NovelState = { ...state, characters: { ...state.characters }, expressions: { ...state.expressions }, se: [] };
  while (s.index < commands.length) {
    const cmd = commands[s.index++];
    switch (cmd.type) {
      case 'background':
        s.background = cmd.name;
        break;
      case 'character':
        if (cmd.name !== null) {
          // 同じキャラが別の位置にいたら移動扱いにする（重複表示しない）
          for (const pos of Object.keys(s.characters) as Position[]) {
            if (s.characters[pos] === cmd.name) s.characters[pos] = null;
          }
        }
        s.characters[cmd.position] = cmd.name;
        break;
      case 'hideAllCharacters':
        s.characters = { left: null, center: null, right: null };
        break;
      case 'still':
        s.still = cmd.name;
        break;
      case 'text':
        s.speaker = cmd.speaker;
        s.text = cmd.text;
        return s;
      case 'end':
        s.ended = true;
        return s;
      case 'expression':
        if (cmd.expression === null) delete s.expressions[cmd.character];
        else s.expressions[cmd.character] = cmd.expression;
        break;
      case 'bgm':
        s.bgm = cmd.name;
        break;
      case 'se':
        s.se.push(cmd.name);
        break;
    }
  }
  s.ended = true;
  return s;
}

/**
 * 途中再開用：保存しておいたコマンド番号まで進めた状態を作る。
 * シナリオが書き換えられて位置が合わない場合は最初から始める。
 */
export function restore(commands: ScenarioCommand[], index: number): NovelState {
  let s = step(commands, initialNovelState);
  while (!s.ended && s.index < index) s = step(commands, s);
  return s.ended || s.index !== index ? step(commands, initialNovelState) : { ...s, se: [] };
}
