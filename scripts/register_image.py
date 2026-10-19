"""画像を登録する（GitHub Actions「画像を登録する」から呼ばれる）。

uploads フォルダの画像を WebP に変換して作品フォルダの正しい場所に置き、
必要なら characters.json / assets.json / info.json に反映する。

入力は環境変数で受け取る：
  STORY_ID      作品ID
  KIND          バストアップ / 全身 / 表情 / 背景 / スチル / 表紙
  NAME          キャラ名、または背景・スチルのシナリオでの名前
  ENGLISH_NAME  英字の名前（ファイル名・新しいキャラのID）
  EXPRESSION    表情名（表情のとき）
  UPLOAD_FILE   uploads 内のファイル名（空なら uploads の画像が1枚のときそれを使う）
  UPDATE_JSON   "true" なら JSON に反映する
問題があれば日本語のメッセージを出して終了コード 1 で終わる（何も変更しない）。
"""

import json
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
STORIES = ROOT / 'public' / 'stories'
UPLOADS = ROOT / 'uploads'
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp'}
ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]+$')

# 種類ごとの置き場所と画質
KINDS = {
    'バストアップ': ('characters', 90),
    '全身': ('characters', 90),
    '表情': ('characters', 90),
    '背景': ('backgrounds', 85),
    'スチル': ('stills', 88),
    '表紙': ('', 85),
}


class RegisterError(Exception):
    pass


def env(key: str) -> str:
    return os.environ.get(key, '').strip()


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def find_upload(upload_file: str) -> Path:
    if upload_file:
        if '/' in upload_file or '\\' in upload_file or upload_file.startswith('.'):
            raise RegisterError(f'ファイル名「{upload_file}」には / や \\ を使えません。uploads フォルダ内のファイル名だけを書いてください')
        path = UPLOADS / upload_file
        if not path.is_file():
            raise RegisterError(f'uploads フォルダに「{upload_file}」が見つかりません')
        return path
    images = sorted(p for p in UPLOADS.glob('*') if p.is_file() and p.suffix.lower() in IMAGE_EXTS) if UPLOADS.exists() else []
    if not images:
        raise RegisterError('uploads フォルダに画像がありません。先に画像をアップロードしてください')
    if len(images) > 1:
        names = '、'.join(p.name for p in images)
        raise RegisterError(f'uploads フォルダに画像が複数あります（{names}）。「uploads 内のファイル名」にどれを使うか書いてください')
    return images[0]


def find_character(characters: list, name: str):
    return next((c for c in characters if c.get('name') == name or c.get('id') == name), None)


def full_image(c: dict):
    full = c.get('full')
    return full.get('image') if isinstance(full, dict) else full


def is_referenced(story_dir: Path, folder: str, file: str) -> bool:
    """その画像ファイルが、まだどこかの設定から使われているか"""
    characters = read_json(story_dir / 'characters.json', {}).get('characters', [])
    assets = read_json(story_dir / 'assets.json', {})
    info = read_json(story_dir / 'info.json', {})
    if folder == 'characters':
        for c in characters:
            if file in (c.get('image'), full_image(c), *(c.get('expressions') or {}).values()):
                return True
        return False
    if folder == '':
        return info.get('cover') == file
    group = {'backgrounds': 'backgrounds', 'stills': 'stills'}[folder]
    return file in (assets.get(group) or {}).values()


def convert(src: Path, dest: Path, quality: int) -> None:
    """WebP に変換して保存する。すでに WebP ならそのままコピーする（画質を落とさないため）"""
    with Image.open(src) as im:
        if im.format == 'WEBP':
            dest.write_bytes(src.read_bytes())
            return
        im = ImageOps.exif_transpose(im)
        has_alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
        im = im.convert('RGBA' if has_alpha else 'RGB')
        im.save(dest, 'WEBP', quality=quality, alpha_quality=100, method=6)


def main() -> list[str]:
    story_id, kind, name = env('STORY_ID'), env('KIND'), env('NAME')
    english, expression, update_json = env('ENGLISH_NAME'), env('EXPRESSION'), env('UPDATE_JSON') != 'false'
    if english.lower().endswith('.webp'):
        english = english[:-5]

    if not ID_PATTERN.match(story_id):
        raise RegisterError(f'作品ID「{story_id}」は半角英数字と _ で書いてください')
    story_dir = STORIES / story_id
    if not story_dir.is_dir():
        raise RegisterError(f'作品フォルダ public/stories/{story_id} がありません')
    if kind not in KINDS:
        raise RegisterError(f'種類「{kind}」は使えません')
    if english and not ID_PATTERN.match(english):
        raise RegisterError(f'英字の名前「{english}」は半角英数字と _ で書いてください（例：kiwi、courtyard）')
    folder, quality = KINDS[kind]
    upload = find_upload(env('UPLOAD_FILE'))

    characters_path, assets_path, info_path = story_dir / 'characters.json', story_dir / 'assets.json', story_dir / 'info.json'
    characters_file = read_json(characters_path, {'characters': []})
    characters = characters_file.setdefault('characters', [])
    assets = read_json(assets_path, {})
    info = read_json(info_path, {})
    old_file = None  # 差し替えで使われなくなるかもしれない古いファイル名
    changes = []

    # ---- 保存するファイル名と、JSON の書き換え内容を決める ----
    if kind in ('バストアップ', '全身', '表情'):
        if not name:
            raise RegisterError('「名前」にキャラ名を書いてください')
        c = find_character(characters, name)
        if c is None:
            if kind == '表情':
                raise RegisterError(f'キャラ「{name}」は characters.json に登録されていません。先にバストアップを登録してください')
            if not english:
                raise RegisterError(f'キャラ「{name}」は新しいキャラなので、「英字の名前」にキャラID（例：kiwi）を書いてください')
            if any(x.get('id') == english for x in characters):
                raise RegisterError(f'キャラID「{english}」はほかのキャラが使っています')
            c = {'id': english, 'name': name}
            if update_json:
                characters.append(c)
                changes.append(f'characters.json：新しいキャラ「{name}」（ID：{english}）を追加')
        if kind == 'バストアップ':
            old_file = c.get('image')
            # 差し替えなら今のファイル名（拡張子は .webp）、新規なら「キャラID_bust.webp」
            file = Path(old_file).stem + '.webp' if old_file else f"{c['id']}_bust.webp"
            c['image'] = file
            label = 'バストアップ（image）'
        elif kind == '全身':
            old_file = full_image(c)
            file = Path(old_file).stem + '.webp' if old_file else f"{c['id']}.webp"
            if isinstance(c.get('full'), dict):
                c['full']['image'] = file
            else:
                c['full'] = file
            label = '全身（full）'
        else:
            if not expression:
                raise RegisterError('「表情名」を書いてください（例：笑顔）')
            expressions = c.setdefault('expressions', {})
            old_file = expressions.get(expression)
            if old_file:
                file = Path(old_file).stem + '.webp'
            elif english:
                file = f"{c['id']}_{english}.webp"
            else:
                raise RegisterError(f'新しい表情「{expression}」なので、「英字の名前」にファイル名に使う英字（例：smile）を書いてください')
            expressions[expression] = file
            label = f'表情「{expression}」'
        if update_json:
            changes.append(f"characters.json：「{c.get('name')}」の{label}を {file} に" + ('（差し替え）' if old_file else '（追加）'))
    elif kind in ('背景', 'スチル'):
        if not name:
            raise RegisterError(f'「名前」にシナリオで使う{kind}の名前を書いてください（例：中庭）')
        group = 'backgrounds' if kind == '背景' else 'stills'
        table = assets.setdefault(group, {})
        old_file = table.get(name)
        if old_file:
            file = Path(old_file).stem + '.webp'
        elif english:
            file = f'{english}.webp'
        else:
            raise RegisterError(f'新しい{kind}「{name}」なので、「英字の名前」にファイル名に使う英字（例：courtyard）を書いてください')
        table[name] = file
        if update_json:
            changes.append(f'assets.json：{kind}「{name}」を {file} に' + ('（差し替え）' if old_file else '（追加）'))
    else:  # 表紙
        old_file = info.get('cover') or None
        file = f'{english}.webp' if english else 'cover.webp'
        info['cover'] = file
        if update_json:
            changes.append(f'info.json：表紙を {file} に' + ('（差し替え）' if old_file else '（追加）'))

    if not ID_PATTERN.match(Path(file).stem):
        raise RegisterError(f'ファイル名「{file}」に使えない文字が入っています。「英字の名前」を書いてください')

    # ---- 画像を変換して置き、JSON を保存する ----
    dest_dir = story_dir / folder if folder else story_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / file
    replaced = dest.exists()
    before = upload.stat().st_size
    convert(upload, dest, quality)
    upload.unlink()

    if update_json:
        if kind in ('バストアップ', '全身', '表情'):
            write_json(characters_path, characters_file)
        elif kind in ('背景', 'スチル'):
            write_json(assets_path, assets)
        else:
            write_json(info_path, info)

        # 古い画像（例：PNG）が使われなくなったら消す
        if old_file and old_file != file:
            old_path = (dest_dir / old_file)
            if old_path.exists() and not is_referenced(story_dir, folder, old_file):
                old_path.unlink()
                changes.append(f'使われなくなった古い画像 {old_file} を削除')

    rel = dest.relative_to(ROOT)
    with Image.open(dest) as out:
        detail = f'{out.width}×{out.height}、透明な部分{"あり" if out.mode in ("RGBA", "LA") else "なし"}'
    lines = [
        f'## ✔ {kind}の画像を登録しました',
        '',
        f'- 画像：`{upload.name}` → `{rel}`（{before // 1024}KB → {dest.stat().st_size // 1024}KB、{detail}）' + ('　※同じ名前の画像を上書き' if replaced else ''),
        *[f'- {c}' for c in changes],
    ]
    if not update_json:
        lines.append('- JSON には反映していません（必要なら設定ファイルに手で書いてください）')
    if dest.stat().st_size > 500 * 1024:
        lines.append('- ⚠ 500KB を超えています。スマホでの読み込みが遅くなることがあります')
    hint = {
        'バストアップ': f'#キャラ画像 {name}',
        '全身': f'#キャラ画像 {name} 全身',
        '表情': f'#表情 {name} {expression}',
        '背景': f'#背景 {name}',
        'スチル': f'#スチル {name}',
    }.get(kind)
    if hint and update_json:
        lines += ['', f'シナリオでは `{hint}` と書くと表示されます。']
    return lines


if __name__ == '__main__':
    try:
        summary = main()
    except RegisterError as e:
        summary = [f'## ✖ 登録できませんでした', '', str(e), '', '何も変更していません。直してからもう一度実行してください。']
        print('\n'.join(summary), file=sys.stderr)
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            Path(os.environ['GITHUB_STEP_SUMMARY']).write_text('\n'.join(summary) + '\n', encoding='utf-8')
        sys.exit(1)
    print('\n'.join(summary))
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write('\n'.join(summary) + '\n')
