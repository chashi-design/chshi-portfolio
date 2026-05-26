# 更新手順ガイド

## 1. どこを編集するか

- コンテンツ更新（基本はここ）
  - `content.json`
- レイアウトの固定文言
  - `templates/index.template.html`
  - `templates/project.template.html`
- スタイル調整
  - `assets/styles.css`
- 最小JS（テーマ切替やUI補助）
  - `assets/app.js`

## 2. 編集してはいけないファイル

- 生成物は直接編集しない
  - `index.html`
  - `projects/<slug>/index.html`

これらは `build/build.js` 実行時に上書きされます。

## 3. 反映コマンド

プロジェクトルートで実行:

```bash
npm run build
```

内部的には以下を実行しています:

```bash
node build/build.js
```

## 4. 追加・変更時の確認ポイント

- `content.json` の `projects` に追加すると、`/projects/<slug>/index.html` が新規生成される
- `slug` は英小文字 + ハイフン形式にする（例: `web-redesign-2025`）
- ビルド後にトップ (`index.html`) と詳細ページ (`/projects/<slug>/`) の表示を確認する

## 5. 公開までの流れ（GitHub Pages / Cloudflare）

1. ファイルを編集
2. `npm run build`
3. 生成物を含めてコミット
4. リモートへ push
5. ホスティング先で反映確認

## 6. よくあるハマりどころ

- 変更したのに画面に出ない
  - `npm run build` を実行していない
  - ブラウザキャッシュが残っている（ハードリロード）
- SNSカードやカード表示が消えた
  - まず `npm run build` を再実行して生成物を更新する
