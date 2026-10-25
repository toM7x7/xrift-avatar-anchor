# 基礎規格v1と確認範囲

2026-10-25。頭専用の初期版から、部位追従・モデル別補正・並列比較の基礎規格v1へ拡張しました。コア、数値マトリクス、比較画面を3サブエージェントで分担し、親担当がレビューと実モデル描画を統合しています。

| 確認対象 | 結果と証拠の範囲 |
|---|---|
| 単体テスト | **35/35成功**。従来20件に頭メッシュ推定7・runtime対象分離6・共有JSON正規化2を追加 |
| 型検査・デモビルド | `npm run verify` 成功。Viteのサイズ警告は残る |
| 数値マトリクス | **1,215/1,215成功**。自作6条件810＋実VRMのGLB metadata405。最大位置誤差約1.99e-12mm |
| 自作骨格ブラウザ | 5条件同時運動、停止、タグ/帽子/小物、頭/胸/左手、補正分離、端数JSON、profile一致/不一致が成功 |
| 実VRMブラウザ | 私有3体（全てVRM0系）を同時描画。4用途×3倍率×3体=**36計測成功**。GLTFLoader/three-vrmの簡易raw姿勢 |
| 参考補正の再現性 | 自作5体・実VRM3体で、倍率/姿勢往復後の中立採寸・補正差0。制御中の姿勢を復元 |
| 見た目 | 初期帽子の埋もれを観測。明示的参考補正後は3体とも頭上に表示。密着/浮き/サイズの人による採用判定は未実施 |
| 実VRM1系 | 未確認。metadata形式のパーサテストだけでは実モデル合格としない |
| 公式ローカルSDK | DevEnvironment 0.58.0のItem差込・中央レイ装着・物理歩行追従・解除・再装着・2配置分離・欠損/曖昧対象の保留が成功 |
| 公式SDK＋実VRM3体 | 頭領域からの12cm補正・歩行追従・解除が成功。追加のVRM姿勢橋渡しを使うローカル検証 |
| 配信済みv2＋公式SDK | CDN配信物を公式Item経由で読込。中央レイ装着・物理歩行追従・解除・2配置分離・倍率再調整が成功。実VRM3体も12cm補正・歩行・解除が成功 |
| 実XRiftへの接続 | 新規アイテムv2を配信、ACTIVE・sceneUrl・配布物SHA一致を確認。インベントリ1枠へ装備。本番の装着/追従/解除はPointerLockエラーで未完了 |
| Quest／他者視点／実複数人 | 未確認 |
| 状態同期／自動離席／Marketplace配布 | 新規タグ配布済み。装着者/表示/高さは配置別の共有状態を実装。実複数人・自動離席は未確認/未実装 |

## 入っている規格と実装

- `createAnchor/updateAnchor` は任意のObject3D部位を受け取り、頭以外にも使用可能。旧head専用APIは互換維持。
- worldメートル補正、bone軸補正、水平/骨/観察者回転、追加Quaternion、独立した表示倍率。
- profile v1はモデルID＋小物IDで一致を選び、部位も照合。他モデル/異なる座標系への補正の流用を防ぐ。
- VRMのraw/normalized取得は明示アダプター。両方ともモデルroot所属を確認。XRiftの胸/手は意味付きmapなしに推測しない。
- shear、反転したsource、特異/非有限変換、自己/祖先を対象にする循環は適用前に拒否。保留時の非表示は呼出側の責任。
- 参考補正は全体BBox上端を使う明示操作。髪や装飾を含む推定であり、頭頂・帽子接触の自動保証ではない。

## 実験で修正した問題

独立レビューから、UI読み込み値のスライダー丸め、非Boneのhumanoidノードの姿勢累積、normalized骨の所属未確認を修正しました。

実描画で見つかった採寸の再現性は、`updateWorldMatrix` だけでは `SkinnedMesh.bindMatrixInverse` の更新が走らないことが原因でした。`updateMatrixWorld(true)` とskeletonを同期し、2件の回帰テストと全モデルの反復採寸を通しています。

私有モデルの画像・本体・実ファイル名はGit対象に含めません。数値入力はSHA256で照合します。V番号は従来A01/A02等の実体を確定するものではありません。VRM0のブラウザは正面補正を行い、profile IDで元座標と区別します。

## 証拠と未確認事項

- [基礎規格v1](ANCHOR-SPEC-v1.md)
- [1,215条件の数値結果](experiments/MATRIX-2026-10-25.md)
- [実VRMの観察・補正前後・採寸修正](experiments/VISUAL-LOOP-2026-10-25.md)
- [自作条件と最終検証JSON](experiments/verification-v1-2026-10-25.json)
- [実モデル描画・参考補正JSON](experiments/browser-local-vrm-final-2026-10-25.json)
- [公式DevEnvironmentでの実操作](experiments/official-sdk-item-2026-10-25.json)
- [公式DevEnvironment＋実VRM3体](experiments/official-sdk-real-vrm-2026-10-25.json)
- [配布v2のACTIVEとSHA256一致](experiments/tag-v2-release-2026-10-25.json)
- [配信済みv2＋公式DevEnvironment](experiments/official-sdk-published-v2-2026-10-25.json)
- [配信済みv2＋実VRM3体](experiments/official-sdk-published-v2-real-vrm-2026-10-25.json)
- [公式ローカルでの再現手順と本番の停止点](experiments/OFFICIAL-LOCAL-2026-10-25.md)

配信済みv2は公式SDKのサーバープロキシ経由で解決し、Module Federationから読み込んだものです。ソース差込とは別に確認しています。実VRM3体の頭領域上端との距離は約0.12m、停止した移動前後の頭/タグと身体の移動量は1mm以内で一致しました。物理storeと描画済み位置を移動中に別時刻で読むと約8.46cmの差が出たため、停止と2描画フレームを待つ計測へ修正しています。この検査は実行中の遅延を保証しません。

本番の個人テストルームでは、アイテムを読み込む前からCanvasクリック時に `WrongDocumentError: The root document of this element is not valid for pointer lock.` が発生しました。配信v2の配置プレビュー読込までは確認しましたが、床へ照準を向けて配置する操作が成立せず、装着・追従・解除の本番受入は未完了です。公式ローカルSDKでは同じブラウザ自動操作でPointerLockと歩行が成功しています。ユーザーによる手動開始が可能か確認待ちで、原因の帰属は確定していません。

公式ローカルの自作骨格検証スクリプトではページ例外/非GETリクエストは0でした。VRM0のLookAtDegreeMap非対応警告があり、視線曲線は確認範囲外です。デモはフルVRMアニメーション・spring bone・XRiftのIKランタイムを再現していません。フレーム遅延、性能、タグ可読性、髪との接触は実機と人の確認が必要です。

初期版の `docs/verification-2026-10-25.json` は当時の記録として保持しています。再実験は毎回新しい `artifacts/experiments/<時刻とID>/` へ保存し、基準結果を上書きしません。

新規タグは [item/overhead-tag](../item/overhead-tag/README.md) に同梱。v1はCDN上のラベル画像がルート相対になり、実XRiftでロード失敗を観測しました。v2で相対参照へ修正し、配布ビルドの検査にも追加しました。基礎規格とアイテムを同じGitHubリポジトリで管理します。元のhead-propeller-ride・既存公開XRiftアイテムは変更していません。npm公開は行っていません。
