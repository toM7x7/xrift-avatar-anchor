# 次のチャットへ

> D:/personal_dev/XRift/lab/xrift-avatar-anchor でAvatar Attachment基礎規格v1を育ててください。まずAGENTS.md、README.md、docs/ANCHOR-SPEC-v1.md、docs/STATUS.md、docs/EXPERIMENTS.mdを読んでください。既存の公開アイテムや元のhead-propeller-rideは変更しません。実験はこのリポジトリに閉じます。
>
> 実装はupdateAnchor/createAnchor、旧head互換API、モデル別profile v1、VRM明示bone取得、XRiftの明示root+bone map入口です。ローカル比較画面ではタグ/帽子/小物、頭/胸/左手、自作5条件と実VRM複数体を扱えます。モデルと小物と部位の補正を独立させています。
>
> 自作6条件と実VRM3体のGLB metadataによる1,215計測、およびローカル実VRM3体の描画を確認しました。実VRMは全て0系で、V01等はSHA256順です。従来のA02問題モデルとの対応は不明。VRM0のブラウザ表示は向きを補正し、profile IDにvrm0-forward-v1を含めるため、GLB元座標の数値profileと混用しないでください。
>
> 初期20cmの帽子補正はモデルによって埋もれます。「中立姿勢の上向きに合わせる」は全体BBox上端+15mmの参考値です。人が帽子の浮き/密着/髪との隙間/サイズを確認して採用する必要があります。参考補正ではSkinnedMeshのbindMatrixInverse更新まで同期して採寸します。制御姿勢へ復元し、再採寸で同じ値になることを保ってください。
>
> 頭上タグの実アイテムは実装・配信済みです。頭に影響するスキン頂点から頭領域上端を推定し、12cm上へ配置します。全身BBoxを使う比較デモの参考補正とは別です。useItemの配置IDで共有状態を分離し、runtimeアダプターは装着者に対応する骨を選び、欠損/曖昧な対象では非表示を保ちます。
>
> 本番PCは手動補助ありで装着・歩行追従・解除まで確認しました。2台配置のうち1台の頭上装着を観測し、通常Wキー600msで約0.876mの歩行に追従、頭とタグの移動量の差は約0.066mm。ユーザーの手動解除後、両台がidle・所有者なし、頭上タグ非表示、装着ボタン復帰を確認しています。自動クリックのPointerLockはWrongDocumentErrorのままで、初回配置/装着クリック自体は計測していません。入力エラーの原因をアイテムと断定しないでください。
>
> ユーザーはアイテム作りを別途議論する方針です。今回の成果は基礎規格と検証記録として扱います。2人の対象分離、Quest、帽子の採用値、実VRM1系などは今後の検証候補であり、今回の完了に含めません。

- GitHub: https://github.com/toM7x7/xrift-avatar-anchor
- 実行: Node.js 22以上、`npm ci` → `npm run dev`。検証は `npm run verify`。
- 数値再実験: `node scripts/run-experiments.mjs --local-vrm`。実VRMなしならフラグを外す。
- 非公開入力は `local-assets/vrm/`、画像は `artifacts/`。モデル本体・画像・実ファイル名をGitへ追加しない。
- 実験の入力/前後/判断/未確認範囲は `docs/experiments/` と `docs/STATUS.md`。初期版の `docs/verification-2026-10-25.json` は当時の記録として残しています。
- 新規タグは `item/overhead-tag`、XRift ID `82fe0855-60d8-4880-9f88-f3c10276796c`、v2 ACTIVE。公式DevEnvironment 0.58.0で中央レイ装着・歩行追従・解除・2配置分離・実VRM3体を検証済み。本番受入の最新結果はSTATUSとrelease証拠を参照し、配信成功だけで装着合格と推測しないでください。
- 公式ローカル: item内で `npm ci` → `npm run dev`。`?published=1` はCDN配信物を読むモードで、ソース差込モードと別に実VRM3体まで検証済み。証拠は `docs/experiments/official-sdk-published-v2*.json`。私有モデル画像は公開しないでください。
