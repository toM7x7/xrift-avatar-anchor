# 基礎規格v1 GitHub反映前レビュー

2026-10-25。対象は、初期コミット `0ca85a2` 以降の基礎規格・profile・既存アダプター・ローカル実験証拠です。今回追加予定の実XRift用タグアイテムとruntimeアダプターは、このレビュー時点では未評価です。

## 結果

基礎規格の公開を止める実装上の問題は見つかりませんでした。

- `npm run verify` は20/20テスト、型検査、Viteビルドが成功。Viteのチャンクサイズ警告は残ります。
- `updateAnchor` は骨・カメラの位置/回転/拡縮を変更しません。表示物との自己/祖先関係、sourceの反転、非有限/特異/shear変換を、表示物への適用前に確認しています。
- profile v1はモデルIDと小物IDを照合し、部位違い・未登録・複数候補を保留します。JSONにはObject3Dやファイルへの参照を入れません。
- VRMアダプターはraw/normalizedともモデルroot所属を確認しています。XRiftの名前探索は保証APIとして扱わず、明示mapを優先する説明と一致しています。
- 実験文書は、自作数値・実VRM metadata・実モデル描画・実XRift・Questを区別しています。参考補正を人が採用した装着値と表記していません。

## Git候補と私有素材

`git ls-files --cached --others --exclude-standard` の候補に、VRM/VRMA、動画、環境変数ファイル、ログはありませんでした。候補のテキストをローカル3VRMの実basenameで照合し、一致なしを確認しました。

候補画像は `docs/screenshots/anchor-demo.png` と `anchor-comparison.png` の2枚で、双方を開き、自作骨格の画像であることを確認しました。実VRM画像はGit対象外の `artifacts/` に分離されています。実験証拠内のSHA256・数値補正・匿名V番号は、入力照合用の値として説明されています。

## 今回のアイテム公開後に更新すること

README/STATUS/NEXT_THREADの「GitHub未反映」「実XRift未確認」「Marketplace未実施」は、このレビュー時点の記録です。実施後は検証したバージョン・item ID・操作・視点・結果を添えて更新してください。基礎規格のローカル成功だけで、実アイテムの装着/追従/解除を合格にしてはいけません。

このレビューは通常の実装・証拠範囲の点検であり、網羅的なセキュリティ監査ではありません。

## 実アイテム追加の再レビュー

同日、`src/overhead.mjs`、`src/adapters/xrift-runtime.mjs`、`item/overhead-tag/src/Item.tsx` と `state.mjs` を追加確認しました。

最初の確認で、共有状態JSONの無検証読み込みと、頭取得保留が台座へ表示されない点を指摘しました。再確認時には両方が修正されていました。`normalizeTagState` がowner/status/補正/serialを正規化し、台座は「頭を確認中」を表示しながら再調整・解除を使えます。

- 状態2件・頭部推定7件・runtime6件の計15テスト成功。
- SDK 0.58.0でも `useItem().id` は配置オブジェクトごとの固有IDと宣言され、状態キーとInteractable IDがそのIDで分離されています。
- 頭部推定はhead由来の頂点を読み、元の骨TRS・親・geometryを書き換えません。source/root/骨格の切替で推定を無効化し、対象不明時は表示を隠します。
- 解除は専用タグのcontrollerをdisposeし、タグを非表示にします。アバターの姿勢・カメラ・移動入力へ介入しません。
- 保存したworld補正を毎フレームのhead位置へ加えるため、単純な歩行移動は採寸周期による追従遅れを生みません。頭部形状・回転・倍率の変化に対する採寸更新は約0.35秒周期の概算です。
- 本体Spriteの `onBeforeRender` は実際の描画カメラを受け、表示物の行列更新後にThree.jsがmodelViewMatrixを計算する順序と整合しています。

`official-sdk-item-2026-10-25.json` は公式DevEnvironment＋自作skinned rigという証拠階層を明記しています。ネイティブ中央レイ・物理歩行・装着/解除の記録があり、歩行量約0.742mに対する頭/タグ移動差は0mmです。これはローカルSDK環境の記録であり、公開XRift・実複数人・Questの証拠へ昇格させません。

再確認した本体・推定・状態処理に、残る公開阻害事項は見つかりませんでした。実配信ビルドのチェック・upload・公開XRiftでの最終操作確認は親担当の別工程です。
