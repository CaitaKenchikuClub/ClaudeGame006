// 日本語シナリオ（.txt）を読み取り、コマンドの一覧に変換する。
// アプリと公開前チェック（scripts/check-stories.ts）の両方から使うため、
// ブラウザ専用の機能や型以外の import は使わないこと。

import type { Position, ScenarioCommand } from './engine';

export interface ScenarioError {
  line: number;
  message: string;
}

export interface ParseResult {
  commands: ScenarioCommand[];
  errors: ScenarioError[];
}

/** 「なし」と書くと消す指定になる */
const NONE = 'なし';

const CHARACTER_COMMANDS: Record<string, Position> = {
  キャラ画像: 'center',
  キャラ画像左: 'left',
  キャラ画像右: 'right',
};

/** 行頭の # （全角 ＃ も可） */
const COMMAND_LINE = /^[#＃]/;
/** 行頭の \# （全角・円記号も可）は「#」という文字として扱う（字下げの後でも可） */
const ESCAPED_HASH = /^(\s*)[\\＼￥¥]([#＃])/;

export function parseScenario(source: string): ParseResult {
  const commands: ScenarioCommand[] = [];
  const errors: ScenarioError[] = [];
  const lines = source.replace(/^﻿/, '').split(/\r\n|\r|\n/);

  // 文章ブロックの集計用
  let blockLines: string[] = [];
  let blockStart = 0;
  /** 今のブロックの話者。undefined = コマンドなしの地の文 */
  let blockSpeaker: string | null | undefined;
  /** #台詞 / #モノローグ の直後で、まだ文章が来ていない行番号 */
  let pendingTextCommand = 0;

  const flushText = () => {
    // 前後の空行は取り除き、途中の空行は残す
    while (blockLines.length > 0 && blockLines[0].trim() === '') {
      blockLines.shift();
      blockStart++;
    }
    while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') blockLines.pop();
    if (blockLines.length > 0) {
      commands.push({ line: blockStart, type: 'text', speaker: blockSpeaker ?? null, text: blockLines.join('\n') });
    } else if (pendingTextCommand) {
      errors.push({ line: pendingTextCommand, message: 'このコマンドの後に文章がありません' });
    }
    blockLines = [];
    blockSpeaker = undefined;
    pendingTextCommand = 0;
  };

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const trimmed = raw.trim();

    if (!COMMAND_LINE.test(trimmed)) {
      if (blockLines.length === 0) blockStart = lineNo;
      // 行頭の全角スペース（字下げ）は残すため、行末だけ空白を取り除く
      blockLines.push(raw.trimEnd().replace(ESCAPED_HASH, '$1$2'));
      return;
    }

    flushText();
    const [rawName, ...args] = trimmed.slice(1).split(/[ 　]+/);
    const name = rawName === 'ＢＧＭ' || rawName.toLowerCase() === 'bgm' ? 'BGM' : rawName;
    const arg = args.join(' ');
    const needArg = (what: string): boolean => {
      if (arg) return true;
      errors.push({ line: lineNo, message: `#${name} の後に${what}を書いてください（例：#${name} ${exampleFor(name)}）` });
      return false;
    };

    if (name in CHARACTER_COMMANDS) {
      if (!needArg('キャラ名')) return;
      const position = CHARACTER_COMMANDS[name];
      if (arg === NONE) {
        commands.push(
          position === 'center' ? { line: lineNo, type: 'hideAllCharacters' } : { line: lineNo, type: 'character', position, name: null },
        );
      } else {
        commands.push({ line: lineNo, type: 'character', position, name: arg });
      }
      return;
    }

    switch (name) {
      case '背景':
        if (needArg('背景名')) commands.push({ line: lineNo, type: 'background', name: arg });
        break;
      case 'スチル':
        if (needArg('スチル名')) commands.push({ line: lineNo, type: 'still', name: arg === NONE ? null : arg });
        break;
      case '台詞':
        if (needArg('キャラ名')) {
          blockSpeaker = arg;
          pendingTextCommand = lineNo;
        }
        break;
      case 'モノローグ':
        blockSpeaker = null;
        pendingTextCommand = lineNo;
        break;
      case '終了':
        commands.push({ line: lineNo, type: 'end' });
        break;
      case '表情':
        if (args.length < 2) {
          errors.push({ line: lineNo, message: '#表情 の後にキャラ名と表情名を書いてください（例：#表情 サクラ 笑顔）' });
        } else {
          commands.push({ line: lineNo, type: 'expression', character: args[0], expression: args.slice(1).join(' ') });
        }
        break;
      case 'BGM':
        if (needArg('曲名')) commands.push({ line: lineNo, type: 'bgm', name: arg === NONE ? null : arg });
        break;
      case '効果音':
        if (needArg('音名')) commands.push({ line: lineNo, type: 'se', name: arg });
        break;
      default:
        errors.push({
          line: lineNo,
          message: `「#${rawName}」は知らないコマンドです。文頭に # を書きたいときは \\# と書いてください`,
        });
    }
  });
  flushText();

  return { commands, errors };
}

function exampleFor(name: string): string {
  switch (name) {
    case '背景':
      return '教室';
    case 'スチル':
      return '夕焼け';
    case 'BGM':
      return '日常';
    case '効果音':
      return 'ドア';
    default:
      return 'サクラ';
  }
}
