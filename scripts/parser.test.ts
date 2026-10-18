// シナリオ読み取りのテスト。使い方：npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScenario } from '../src/novel/parser.ts';
import { initialNovelState, restore, step } from '../src/novel/engine.ts';
import { validateScenario } from '../src/novel/validate.ts';

const strip = (cmds: { line: number }[]) => cmds.map(({ line: _line, ...rest }) => rest);

test('依頼書の基本例を読み取れる', () => {
  const { commands, errors } = parseScenario(`#背景 教室

#キャラ画像 サクラ

#台詞 サクラ
どうしたの？

#モノローグ
今日はいい天気だ。

#キャラ画像右 サクラ
#キャラ画像左 ルリ

#台詞 ルリ
ちょっと話があるんだけど……。

#キャラ画像 なし

#スチル 夕焼け

#モノローグ
私たちは、沈んでいく夕日を見つめていた。

#終了
`);
  assert.deepEqual(errors, []);
  assert.deepEqual(strip(commands), [
    { type: 'background', name: '教室' },
    { type: 'character', position: 'center', name: 'サクラ' },
    { type: 'text', speaker: 'サクラ', text: 'どうしたの？' },
    { type: 'text', speaker: null, text: '今日はいい天気だ。' },
    { type: 'character', position: 'right', name: 'サクラ' },
    { type: 'character', position: 'left', name: 'ルリ' },
    { type: 'text', speaker: 'ルリ', text: 'ちょっと話があるんだけど……。' },
    { type: 'hideAllCharacters' },
    { type: 'still', name: '夕焼け' },
    { type: 'text', speaker: null, text: '私たちは、沈んでいく夕日を見つめていた。' },
    { type: 'end' },
  ]);
});

test('空行を含む複数行を1つの文章にし、前後の空行は取り除く', () => {
  const { commands } = parseScenario('#台詞 サクラ\n\n「一行目\n\n三行目」\n\n\n#終了');
  assert.deepEqual(strip(commands)[0], { type: 'text', speaker: 'サクラ', text: '「一行目\n\n三行目」' });
  assert.equal(commands[0].line, 3);
});

test('コマンドなしの文章は地の文。行頭の全角スペースは残す', () => {
  const { commands } = parseScenario('#台詞 サクラ\nこんにちは\n#背景 教室\n　字下げした地の文');
  assert.deepEqual(strip(commands), [
    { type: 'text', speaker: 'サクラ', text: 'こんにちは' },
    { type: 'background', name: '教室' },
    { type: 'text', speaker: null, text: '　字下げした地の文' },
  ]);
});

test('文中の # はそのまま、行頭の \\# は # という文字になる', () => {
  const { commands, errors } = parseScenario('今日の #話題 は\n\\#タグ\n　＼＃全角');
  assert.deepEqual(errors, []);
  assert.deepEqual(strip(commands), [{ type: 'text', speaker: null, text: '今日の #話題 は\n#タグ\n　＃全角' }]);
});

test('全角の ＃ と全角スペースでもコマンドとして読む。CRLF と BOM にも対応', () => {
  const { commands, errors } = parseScenario('﻿＃背景　教室\r\n#キャラ画像左 なし\r\n#BGM なし\r\n#表情 サクラ 笑顔');
  assert.deepEqual(errors, []);
  assert.deepEqual(strip(commands), [
    { type: 'background', name: '教室' },
    { type: 'character', position: 'left', name: null },
    { type: 'bgm', name: null },
    { type: 'expression', character: 'サクラ', expression: '笑顔' },
  ]);
});

test('間違いを行番号つきで見つける', () => {
  const { errors } = parseScenario('#背影 教室\n#台詞 サクラ\n#背景\n#モノローグ');
  assert.deepEqual(
    errors.map((e) => e.line),
    [1, 2, 3, 4],
  );
  assert.match(errors[0].message, /「#背影」は知らないコマンド/);
  assert.match(errors[1].message, /文章がありません/);
  assert.match(errors[2].message, /背景名を書いてください/);
});

test('立ち絵の移動・全員非表示・スチル', () => {
  const { commands } = parseScenario('#キャラ画像 サクラ\n#キャラ画像右 サクラ\n#スチル 夕焼け\nA\n#キャラ画像 なし\n#スチル なし\nB');
  const s1 = step(commands, initialNovelState);
  assert.deepEqual(s1.characters, { left: null, center: null, right: 'サクラ' });
  assert.equal(s1.still, '夕焼け');
  const s2 = step(commands, s1);
  assert.deepEqual(s2.characters, { left: null, center: null, right: null });
  assert.equal(s2.still, null);
  assert.equal(step(commands, s2).ended, true);
});

test('登録されていないキャラ・背景・スチルを見つける', () => {
  const { commands } = parseScenario('#キャラ画像 ミナ\n#背景 校庭\n#スチル 星空\n#台詞 店員\nいらっしゃいませ');
  const errors = validateScenario(commands, [{ id: 'sakura', name: 'サクラ', image: 's.png' }], { backgrounds: {} });
  assert.deepEqual(
    errors.map((e) => e.line),
    [1, 2, 3],
  );
});

test('表情・BGM・効果音を状態に反映する。効果音はその場面だけ鳴る', () => {
  const { commands } = parseScenario('#BGM 日常\n#効果音 ドア\n#表情 サクラ 笑顔\nA\n#モノローグ\nB\n#表情 サクラ なし\n#BGM なし\nC');
  const s1 = step(commands, initialNovelState);
  assert.equal(s1.bgm, '日常');
  assert.deepEqual(s1.se, ['ドア']);
  assert.deepEqual(s1.expressions, { サクラ: '笑顔' });
  const s2 = step(commands, s1);
  assert.equal(s2.text, 'B');
  assert.equal(s2.bgm, '日常', 'BGM は場面をまたいで続く');
  assert.deepEqual(s2.se, []);
  const s3 = step(commands, s2);
  assert.equal(s3.bgm, null);
  assert.deepEqual(s3.expressions, {});
});

test('途中再開：保存した位置の状態を復元し、位置が合わなければ最初から', () => {
  const { commands } = parseScenario('#背景 教室\n#BGM 日常\nA\n#効果音 ドア\n#背景 廊下\nB\n#終了');
  const s2 = step(commands, step(commands, initialNovelState));
  const restored = restore(commands, s2.index);
  assert.equal(restored.text, 'B');
  assert.equal(restored.background, '廊下');
  assert.equal(restored.bgm, '日常');
  assert.deepEqual(restored.se, [], '再開時に効果音は鳴らさない');
  assert.equal(restore(commands, 999).text, 'A');
  assert.equal(restore(commands, 1).text, 'A');
});

test('登録されていない表情・BGM・効果音を見つける', () => {
  const { commands } = parseScenario('#表情 サクラ 泣き\n#表情 ミナ 笑顔\n#BGM 戦闘\n#効果音 爆発\n#表情 サクラ なし');
  const errors = validateScenario(
    commands,
    [{ id: 'sakura', name: 'サクラ', image: 's.png', expressions: { 笑顔: 's2.png' } }],
    { bgm: { 日常: 'a.mp3' }, se: {} },
  );
  assert.deepEqual(
    errors.map((e) => e.line),
    [1, 2, 3, 4],
  );
});
