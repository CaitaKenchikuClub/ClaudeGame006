import type { ScenarioCommand } from './engine';

// Phase 2 の動作確認用シナリオ。
// Phase 3 で scenarios/*.txt を読み込む方式に置き換える。
const demos: Record<string, ScenarioCommand[]> = {
  novel_001: [
    { type: 'background', name: '教室' },
    { type: 'text', speaker: null, text: '放課後の教室。窓から差し込む光が、机の上でまどろんでいる。' },
    { type: 'character', position: 'center', name: 'サクラ' },
    { type: 'text', speaker: 'サクラ', text: '「あれ？　まだ誰か残ってたんだ」' },
    { type: 'character', position: 'right', name: 'サクラ' },
    { type: 'character', position: 'left', name: 'ルリ' },
    { type: 'text', speaker: 'ルリ', text: '「……ちょっと、話があるんだけど」' },
    { type: 'text', speaker: 'サクラ', text: '「話？　わたしに？」' },
    {
      type: 'text',
      speaker: null,
      text:
        'ルリはそれきり黙ってしまった。\n\n窓の外では、運動部のかけ声が遠くに聞こえる。時計の秒針の音だけが、やけに大きく響いていた。\n長い文章でもメッセージウィンドウの中で読めるかどうかを確認するために、この段落は少し長めに書いてある。三行、四行と続いても、表示が崩れないことが大切だ。',
    },
    { type: 'hideAllCharacters' },
    { type: 'background', name: '廊下' },
    { type: 'text', speaker: null, text: '気がつくと、廊下は夕焼けの色に染まっていた。' },
    { type: 'character', position: 'center', name: 'ルリ' },
    { type: 'text', speaker: 'ルリ', text: '「明日、また話す。……約束」' },
    { type: 'end' },
  ],
  novel_002: [
    { type: 'background', name: '夜の町' },
    { type: 'text', speaker: null, text: '星のよく見える夜だった。' },
    { type: 'character', position: 'center', name: 'カイ' },
    { type: 'text', speaker: 'カイ', text: '「……本が、空から？」' },
    { type: 'text', speaker: null, text: '足元に落ちてきた古い本は、かすかに光っていた。' },
    { type: 'end' },
  ],
};

export function getDemoScenario(storyId: string): ScenarioCommand[] {
  return (
    demos[storyId] ?? [
      { type: 'text', speaker: null, text: 'この作品の動作確認用シナリオはまだありません。' },
      { type: 'end' },
    ]
  );
}
