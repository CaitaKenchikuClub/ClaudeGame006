# ClaudeGame006

Web小説試し読みノベルゲーム

複数のWeb小説作品の第1話や見せ場を、ビジュアルノベル形式で楽しめるゲームアプリです。
React + TypeScript + Vite で作成し、GitHub Pages で公開しています（Android 版は将来 Capacitor で対応予定）。

公開URL：https://caitakenchikuclub.github.io/ClaudeGame006/

## 説明書

| 説明書 | 内容 |
|---|---|
| [作品の追加方法](docs/作品の追加方法.md) | 作品・エピソードの追加手順、設定ファイルの書き方、画像・音声の推奨形式、公開のしかた |
| [シナリオの書き方](docs/シナリオの書き方.md) | シナリオ（.txt）のコマンド一覧、文章のルール、エラーの直し方 |
| [キャラ画像の作り方（ChatGPT）](docs/キャラ画像の作り方（ChatGPT）.md) | キャラクターシートから全身の立ち絵とバストアップを作るプロンプト、仕上げ方、登録のしかた |
| [背景画像の作り方（ChatGPT）](docs/背景画像の作り方（ChatGPT）.md) | 背景画像を作るプロンプト、時間違いの作り方、登録のしかた |

新しい作品フォルダは、**Actions タブの「新しい作品フォルダを作る」** で作品ID を入力するだけで作れます（`templates/story_template` の中身が空のひな形がコピーされます）。ゲーム本体のプログラムを編集する必要はありません。

設定ファイル（JSON）は **[設定ファイル作成ツール](https://caitakenchikuclub.github.io/ClaudeGame006/tools/json-generator.html)** で、入力欄に書くだけで作れます（コピー・ダウンロード・既存ファイルの読み込みに対応）。

シナリオは **[シナリオエディタ](https://caitakenchikuclub.github.io/ClaudeGame006/tools/scenario-editor.html)** で、コマンドをボタンで入れながら書けます（登録済みの名前を選択・かんたんチェック・ダウンロードに対応）。

## フォルダ構成

```
public/stories/          … 作品データ（作品ごとにフォルダを分けて管理）
  catalog.json           … 作品一覧（ここに書いた順に並ぶ）
  novel_001/             … 作品フォルダ（info.json・characters.json・assets.json・シナリオ・素材）
public/tools/            … 設定ファイル作成ツール（json-generator.html）、シナリオエディタ（scenario-editor.html）
templates/story_template … 新しい作品のひな形（設定ファイルのみ・中身は空）
docs/                    … 説明書
src/                     … ゲーム本体
scripts/                 … 公開前チェックとテスト
.github/workflows/       … GitHub Pages への自動公開、作品フォルダ作成ボタン
```

## 開発コマンド

```bash
npm install      # 初回のみ
npm run dev      # 開発サーバー起動（表示されたURLをブラウザで開く）
npm run check    # 全作品のシナリオ・設定・素材をチェック
npm run new-story -- 作品ID   # 新しい作品フォルダを作る
npm test         # シナリオ読み取り機能のテスト
npm run build    # チェック＋本番ビルド（dist/ に出力）
npm run preview  # ビルド結果の確認
```

`main` ブランチにプッシュすると、GitHub Actions がテスト・チェック・ビルドを行い、GitHub Pages に公開します。
チェックで問題が見つかった場合は公開されません（Actions タブで日本語の問題一覧を確認できます）。

## プレイヤー向けの機能

- タップで文章を進める（表示途中のタップで全文表示）
- **オート**：文章を自動で読み進める
- **ログ**：これまでの文章を読み返す
- **設定**：文字の表示速度、オート再生の速度、BGM・効果音の音量、ミュート
- **続きから**：途中でやめたエピソードを再開できる
- **読了記録**：読み終えたエピソードに「読了」と表示される

設定・再開位置・読了記録はブラウザ（端末）の中に保存されます。サーバーには送られません。

### 端末ごとの注意

- **iPhone / iPad**：OS の仕様により、ページ内の音量スライダーは効きません。音量は本体の音量ボタンで調整してください（ミュートは効きます）
- **音が出るタイミング**：ブラウザの自動再生制限により、最初の音は画面をタップした後に鳴り始めることがあります
- **スマホを横向きにした場合**：縦向きにするよう案内が表示されます

## GitHub Pages の公開設定（設定済み）

リポジトリの **Settings → Pages → Build and deployment → Source** が **GitHub Actions** になっていれば、`main` へのプッシュで自動公開されます。

> リポジトリ名を変更した場合は `vite.config.ts` の `base` も同じ名前に変更してください。
