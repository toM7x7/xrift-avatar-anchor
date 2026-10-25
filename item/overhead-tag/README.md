# 自動調整・頭上ステータスタグ

基礎規格v1を使う配布用XRiftアイテムです。元プロペラや公開済みの別アイテムから分離しています。

- アイテムID: `82fe0855-60d8-4880-9f88-f3c10276796c`
- バージョン1: 2026-10-25、アップロード・審査ACTIVE・sceneUrl発行を確認。
- バージョン2: 本番で判明した画像URLのルート相対参照を修正。`base:'./'` でCDN内相対参照にし、再アップロード・ACTIVE・配信SHA256一致を確認。
- [XRiftアイテム](https://app.xrift.net/marketplace/82fe0855-60d8-4880-9f88-f3c10276796c)

## 使う

インベントリへ装備してワールド内へ台座を配置します。「装着する」で自分の頭を対象にし、「外す」で解除します。「表示切替」は作業中／離席中／話しかけてOK。「再調整」は採寸し直し、上下は3cmずつ手直しします。

頭を特定できない間は台座が「頭を確認中」になり、頭上のタグを非表示にします。別の人や近い人へ推測で接続しません。装着中もアバター・入力・カメラの所有権は変更しません。

頭の子ボーンに一定以上影響されるスキン頂点を最大6,000個サンプルし、頭領域の上端から12cm上を基準にします。全身BBox・中立姿勢へのリセットは使いません。頭の移動へ毎フレーム追従し、形状・回転・倍率の再採寸は約0.35秒ごとです。髪や間引きによる概算のため、全モデルへの装着適合は保証しません。

## 公式ローカル環境で試す

```sh
npm ci
npm run dev
```

[localhost:5237](http://127.0.0.1:5237/) は公式 `DevEnvironment`（world-components 0.58.0）の `items` 差込を使います。`@xrift/sdk/vite` の `xriftDev()` と専用の `dev-world.xrift.json` で宣言も確認します。ローカル用の仮IDは配信先の実アイテムIDと区別しています。

`?published=1` を付けるとソース差込を外し、同じ公式Itemが公開済みの実アイテムIDを解決してCDNのModule Federationを読み込みます。CLIの認証済み環境とAPIへ到達できるネットワークが必要です。CLIトークンは開発サーバーだけが使用し、ブラウザへ渡しません。配信済みv2でも装着・歩行追従・解除・実VRM3体の自動補正を確認しました。[結果と再現手順](../../docs/experiments/OFFICIAL-LOCAL-2026-10-25.md)

公式環境が担当するのは物理歩行・入力・中央レイ・ItemProvider・配置IDです。標準DummyAvatarは骨を持たないため、動きに連動する自作骨格またはローカル実VRMを追加しています。観察カメラも独自の検証機能です。これらを実XRiftやVR実機の確認済みとは扱いません。

検証用の横ボタンはSDK Interactableのハンドラーを呼びます。「台座へ向く」を押し、Canvasをクリックする経路では公式の中央レイを通します。CanvasはWASD・Space・マウスで操作します。検証の自動化ではマウスロックをAPIで解除します。通常操作の解除はブラウザのEscです。

```sh
npx --yes --package @playwright/cli playwright-cli -s=head-tag open http://127.0.0.1:5237/
npx --yes --package @playwright/cli playwright-cli -s=head-tag run-code --filename=scripts/check-sdk-item.js
```

ローカルVRMを1体選んだ後は `scripts/check-sdk-vrm.js`。実ファイル名・モデル本体はソースへ入れません。私有画像はGit対象外のルート `artifacts/` へ保存します。MCPで実行する場合は、撮影先をリポジトリ内の絶対パスへ変更してください。

## ビルドと更新

```sh
npm run build
npx --yes @xrift/cli@latest check item --json
npx --yes @xrift/cli@latest upload item
```

`.xrift/item.json` を維持し、更新では同じアイテムIDを使います。thumbnailは自作骨格と実際のタグのプレビューを512×512で撮影したものです。日本語ラベルPNGは `scripts/generate-labels.ps1` でローカルに描画し、フォントファイル自体は再配布していません。

ビルド末尾の `verify-distribution.mjs` は、画像URLがアイテムのCDNディレクトリを逸脱しないこと、実ファイルの存在、512×512サムネイル、私有VRMの非同梱を確認します。

共有状態は配置IDごとに分離し、不正なJSONは読込時に正規化します。装着・表示・高さ補正はインスタンス内の状態で、アバター別の永続保存や自動離席判定は実装していません。Quest・他者視点・実複数人は未確認です。

実XRiftでは手動セットアップ後に2台配置と1台の頭上装着を観測し、通常Wキーによる約0.876mの歩行追従を確認しました。手動解除後、所有者クリア・頭上タグ非表示・装着ボタン復帰も確認済みです。自動クリック時のPointerLockは `WrongDocumentError` となるため視点旋回には手動補助が必要でした。[本番計測](../../docs/experiments/native-tag-2026-10-25.json)。公式ローカルの結果と手動補助ありの本番PCの結果を区別します。
