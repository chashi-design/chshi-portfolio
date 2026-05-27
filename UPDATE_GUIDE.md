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

## 4. iPhone + Tailscale で確認する

開発中に iPhone から確認する場合は、`localhost` ではなく Tailscale 経由の URL を使います。

```bash
PUBLIC_HOST=takanorino-mac.tailnet.ts.net npm run dev:remote
```

- `PUBLIC_HOST` は必須
- `PORT` は省略時 `4173`
- 起動後に以下の 2 つが表示される
  - Mac 内確認: `http://127.0.0.1:4173`
  - iPhone 確認: `http://$PUBLIC_HOST:4173`

ポートを変える場合:

```bash
PUBLIC_HOST=takanorino-mac.tailnet.ts.net PORT=4273 npm run dev:remote
```

`dev:remote` は以下を自動で行います。

- 初回 build
- `content.json`
- `templates/**`
- `assets/**`
- `build/**`

これらの変更を監視し、同じ URL のまま自動で再 build します。

## 5. 追加・変更時の確認ポイント

- `content.json` の `projects` に追加すると、`/projects/<slug>/index.html` が新規生成される
- `slug` は英小文字 + ハイフン形式にする（例: `web-redesign-2025`）
- ビルド後にトップ (`index.html`) と詳細ページ (`/projects/<slug>/`) の表示を確認する

## 6. 開発フロー

1. `main` から作業ブランチを切る
2. SSH で自宅Macに入り、`PUBLIC_HOST=... npm run dev:remote` を起動する
3. Codex に修正を依頼する
4. iPhone を Tailscale 接続した状態で `http://$PUBLIC_HOST:4173` を開く
5. 同じ URL を見ながら追加修正を依頼する
6. `npm run build` または `dev:remote` の自動 build 結果を確認する
7. commit / push する
8. Codex の GitHub 連携で PR を作成する

PR 作成後に同じブランチへ追加 push しても、iPhone 確認 URL は変わりません。

## 7. 公開までの流れ（GitHub Pages / Cloudflare）

1. ファイルを編集
2. `npm run build`
3. 生成物を含めてコミット
4. リモートへ push
5. ホスティング先で反映確認

## 8. よくあるハマりどころ

- 変更したのに画面に出ない
  - `npm run build` を実行していない
  - `dev:remote` を起動していない
  - iPhone Safari のキャッシュが残っている（再読込）
- SNSカードやカード表示が消えた
  - まず `npm run build` を再実行して生成物を更新する
- iPhone から開けない
  - iPhone が Tailscale に接続されていない
  - `PUBLIC_HOST` が現在の MagicDNS 名と一致していない
  - Mac 側で `dev:remote` が止まっている
