// 公開前チェック：全作品の設定ファイル・シナリオ・素材を調べ、問題を一覧表示する。
// 使い方：npm run check
// 問題があれば終了コード 1 で終わる（GitHub Actions では公開が止まる）。

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseScenario } from '../src/novel/parser.ts';
import { validateScenario } from '../src/novel/validate.ts';
import type { AssetsFile, Catalog, CharactersFile, StoryInfo } from '../src/types.ts';

const STORIES_DIR = join(import.meta.dirname, '..', 'public', 'stories');

const problems: string[] = [];
const report = (where: string, message: string) => problems.push(`${where}：${message}`);

function readJson<T>(path: string, where: string): T | null {
  if (!existsSync(path)) {
    report(where, 'ファイルがありません');
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8').replace(/^﻿/, '')) as T;
  } catch (e) {
    report(where, `JSON の書き方に誤りがあります（${(e as Error).message}）`);
    return null;
  }
}

function requireFile(storyId: string, folder: string, file: string, where: string) {
  if (!existsSync(join(STORIES_DIR, storyId, folder, file))) {
    report(where, `ファイル ${storyId}/${folder ? folder + '/' : ''}${file} がありません`);
  }
}

const catalog = readJson<Catalog>(join(STORIES_DIR, 'catalog.json'), 'catalog.json');
if (catalog && !Array.isArray(catalog.stories)) report('catalog.json', '"stories" の一覧がありません');
const storyIds = Array.isArray(catalog?.stories) ? catalog.stories : [];
let scenarioCount = 0;

for (const id of storyIds) {
  const info = readJson<StoryInfo>(join(STORIES_DIR, id, 'info.json'), `${id}/info.json`);
  const chars = readJson<CharactersFile>(join(STORIES_DIR, id, 'characters.json'), `${id}/characters.json`);
  const assets = readJson<AssetsFile>(join(STORIES_DIR, id, 'assets.json'), `${id}/assets.json`) ?? {};
  const characters = Array.isArray(chars?.characters) ? chars.characters : [];

  // 作品情報
  if (info) {
    const where = `${id}/info.json`;
    if (info.id !== id) report(where, `"id" はフォルダ名と同じ "${id}" にしてください`);
    for (const key of ['title', 'author', 'cover', 'summary', 'synopsis', 'genre', 'originalUrl'] as const) {
      if (typeof info[key] !== 'string' || info[key] === '') report(where, `"${key}" が書かれていません`);
    }
    if (info.cover) requireFile(id, '', info.cover, where);
    if (!Array.isArray(info.episodes) || info.episodes.length === 0) report(where, '"episodes" にエピソードがありません');
  }

  // キャラクター設定
  if (chars && !Array.isArray(chars.characters)) report(`${id}/characters.json`, '"characters" の一覧がありません');
  const seen = new Set<string>();
  for (const c of characters) {
    const where = `${id}/characters.json（${c.name ?? c.id ?? '名前なし'}）`;
    if (!c.id || !c.name) report(where, '"id" と "name" を書いてください');
    if (!c.image) report(where, '"image" を書いてください');
    else requireFile(id, 'characters', c.image, where);
    for (const key of [c.id, c.name]) {
      if (key && seen.has(key)) report(where, `「${key}」が重複しています`);
      if (key) seen.add(key);
    }
  }

  // 素材設定
  for (const [kind, folder] of [['backgrounds', 'backgrounds'], ['stills', 'stills']] as const) {
    for (const [name, file] of Object.entries(assets[kind] ?? {})) {
      requireFile(id, folder, file, `${id}/assets.json（${kind}「${name}」）`);
    }
  }

  // シナリオ
  for (const ep of Array.isArray(info?.episodes) ? info.episodes : []) {
    const where = `${id}/scenarios/${ep.file}`;
    if (!ep.id || !ep.title || !ep.file || typeof ep.order !== 'number') {
      report(`${id}/info.json（エピソード ${ep.title ?? ep.id ?? '?'}）`, '"id" "title" "file" "order" を書いてください');
    }
    if (!ep.file) continue;
    const path = join(STORIES_DIR, id, 'scenarios', ep.file);
    if (!existsSync(path)) {
      report(where, 'シナリオファイルがありません');
      continue;
    }
    scenarioCount++;
    const parsed = parseScenario(readFileSync(path, 'utf-8'));
    const errors = [...parsed.errors, ...validateScenario(parsed.commands, characters, assets)];
    for (const e of errors.sort((a, b) => a.line - b.line)) report(`${where} ${e.line}行目`, e.message);
  }
}

if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} 件の問題が見つかりました\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`✔ 問題はありません（作品 ${storyIds.length} 件、シナリオ ${scenarioCount} 件）`);
