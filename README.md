# ClaudeGame006

Web小説試し読みノベルゲーム

複数のWeb小説作品の第1話や見せ場を、ビジュアルノベル形式で楽しめるゲームアプリです。
React + TypeScript + Vite で作成し、GitHub Pages で公開します（Android 版は将来 Capacitor で対応予定）。

## 開発コマンド

```bash
npm install      # 初回のみ
npm run dev      # 開発サーバー起動（表示されたURLをブラウザで開く）
npm run build    # 本番ビルド（dist/ に出力）
npm run preview  # ビルド結果の確認
```

## フォルダ構成

```
public/stories/          … 作品データ（ゲーム本体のコードとは独立）
  catalog.json           … 作品一覧（表示する作品IDを並べる）
  novel_001/
    info.json            … 作品情報（タイトル・作者・あらすじ・原作URL・エピソード一覧）
    characters.json      … キャラクター情報
    cover.svg            … 表紙画像
    scenarios/           … シナリオ（日本語テキスト .txt）
    backgrounds/         … 背景画像
    characters/          … 立ち絵画像
    stills/              … スチル画像
    audio/               … BGM・効果音
src/                     … ゲーム本体
.github/workflows/       … GitHub Pages 自動デプロイ設定
```

## 作品の追加方法（概要）

1. `public/stories/novel_001` をコピーして新しいフォルダ（例：`novel_003`）を作る
2. `info.json` の `id` をフォルダ名と同じにし、タイトルなどを書き換える
3. 表紙画像を入れ、`info.json` の `cover` にファイル名を書く
4. `public/stories/catalog.json` の `stories` に作品ID を追加する

ゲーム本体のソースコードを編集する必要はありません。
（シナリオ記法の詳しい説明は今後のフェーズで追加します）

## GitHub Pages の公開設定（最初に1回だけ）

1. GitHub でこのリポジトリを開く
2. 上部の **Settings** をクリック
3. 左メニューの **Pages** をクリック
4. **Build and deployment** の **Source** を **GitHub Actions** に変更する
5. `main` ブランチにプッシュすると自動でビルド・公開される
   （進行状況は **Actions** タブで確認できます。緑のチェックが付けば公開完了）

公開URL: https://caitakenchikuclub.github.io/ClaudeGame006/

> リポジトリ名を変更した場合は `vite.config.ts` の `base` も同じ名前に変更してください。
