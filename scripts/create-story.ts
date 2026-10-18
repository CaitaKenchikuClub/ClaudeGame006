// 新しい作品フォルダを作る：templates/story_template を public/stories/<作品ID> にコピーし、
// info.json に作品ID（と、指定があればタイトル・作者名）を書き込む。
// 作品一覧（catalog.json）には登録しない（中身ができてから登録する）。
//
// 使い方：npm run new-story -- 作品ID [タイトル] [作者名]
// GitHub Actions からは環境変数 STORY_ID / STORY_TITLE / STORY_AUTHOR で渡す。

import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'templates', 'story_template');
const STORIES_DIR = join(ROOT, 'public', 'stories');

const [argId, argTitle, argAuthor] = process.argv.slice(2);
const id = (process.env.STORY_ID ?? argId ?? '').trim();
const title = (process.env.STORY_TITLE ?? argTitle ?? '').trim();
const author = (process.env.STORY_AUTHOR ?? argAuthor ?? '').trim();

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!id) fail('作品ID を入力してください');
if (!/^[A-Za-z0-9_-]+$/.test(id)) fail(`作品ID「${id}」は半角英数字と _ で付けてください（例：ningyo_to_hime）`);
if (id === 'catalog.json' || id === 'templates') fail(`「${id}」は作品ID に使えません`);
const dest = join(STORIES_DIR, id);
if (existsSync(dest)) fail(`public/stories/${id} はすでにあります。別の作品ID にしてください`);

cpSync(TEMPLATE_DIR, dest, { recursive: true });

const infoPath = join(dest, 'info.json');
const info = JSON.parse(readFileSync(infoPath, 'utf-8'));
info.id = id;
if (title) info.title = title;
if (author) info.author = author;
writeFileSync(infoPath, JSON.stringify(info, null, 2) + '\n');

console.log(`✔ public/stories/${id} を作りました`);
// GitHub Actions の次の手順に、確定した作品ID を渡す
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `id=${id}\n`);
