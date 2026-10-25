# 公式ローカル環境での頭上タグ検証

2026-10-25。world-components 0.58.0の公式DevEnvironment、公式Item、SDK 0.2.0のxriftDevプロキシを使用しました。

## 再現

```powershell
cd D:\personal_dev\XRift\lab\xrift-avatar-anchor\item\overhead-tag
npm ci
npm run dev
```

- `http://127.0.0.1:5237/`: itemsによるソース差込。
- `http://127.0.0.1:5237/?published=1`: 実アイテムIDを公式サーバープロキシで解決し、CDN配信物を読み込む。CLI認証と外部APIへ接続可能な開発サーバーが必要。
- 今回の配信物検証では、外部接続可能な別サーバーを5238で起動した。配信URLはv2のrelease JSON、SHA256はローカルビルドと一致。
- 自作骨格で `scripts/check-sdk-item.js`、ローカルVRMを1体選んで `scripts/check-sdk-vrm.js`。Playwright CLIからrun-codeする。MCP実行では撮影先をリポジトリ内の絶対パスへ変更する。

公式環境が担当するのは入力、物理歩行、中央レイ、ユーザー/共有状態コンテキスト、ItemProviderと配信物解決。標準の箱型アバターに骨がないため、追加の自作スキン骨格または私有VRMをSDK移動へ連動させた。観察カメラと横の操作ボタンも検証用の追加実装である。

## 結果

| 対象 | ソース差込 | CDNの配信済みv2 |
|---|---|---|
| 中央レイで装着、PointerLock、SDK歩行追従 | 成功 | 成功 |
| 解除・再装着・表示切替 | 成功 | 成功 |
| 2配置の状態分離 | 成功 | 成功 |
| 頭欠損・曖昧な別骨格では非表示 | 成功 | 成功 |
| 倍率0.6/1.4/1.0で自動再採寸 | 成功 | 成功 |
| 実VRM3体の12cm補正、歩行、解除 | 成功 | 成功 |

配信済みv2の自作骨格では歩行約0.746m、身体/頭/タグの移動量の差は計測上0mm。実VRM3体の上端距離は0.119999〜0.120002m、停止前後の移動量の差は1mm未満だった。私有モデルは全てVRM0で、数値記録ではSHA256のみを使い、本体・画像・実ファイル名をGitへ追加していない。

実VRMの初回計測では、移動中に物理storeが描画済み骨格より先へ進み、身体と頭/タグの差が約0.08456mとなった。頭とタグ同士の移動量は一致していた。比較スクリプトは速度0と2描画フレームを待って停止位置同士を比べるよう修正した。これは実行中のフレーム遅延を測る試験ではない。

- [自作骨格の配信v2記録](official-sdk-published-v2-2026-10-25.json)
- [実VRM3体の配信v2記録](official-sdk-published-v2-real-vrm-2026-10-25.json)
- [公式プロキシのv2解決と読込URL一致](official-sdk-published-v2-resolution-2026-10-25.json)
- [ソース差込記録](official-sdk-item-2026-10-25.json) / [実VRM3体](official-sdk-real-vrm-2026-10-25.json)
- [配信v2での観察画像](../screenshots/official-sdk-tag-published-v2.png)

JSON中の `officialItemInjection: false` はCDN読込モードの選択を示し、失敗を示すフラグではない。`publishedFederation: true` が配信物読込を示す。

実アイテムIDのresolveは有効な最新版を返すため、バージョンを固定していない。画面/記録のv2表記は今回の検証時点を示す。再実験ではresolveのversionNumber・sceneUrlと実際の読込remoteEntryを照合し、更新されていれば新しい版の記録として残す。

## 本番の追加確認

実XRiftでは新規アイテムが有効になり、インベントリの1枠へ装備できた。v1のラベル画像URLがCDNルートを指す失敗を観測し、v2でアイテム配下の相対参照へ修正した。v2の配置プレビューとInteractableの生成を確認した。

本番Canvasの自動クリックでは `WrongDocumentError: The root document of this element is not valid for pointer lock.` が発生した。その後、ユーザーから手動なら開始できたとの回答があり、2台配置と1台の頭上装着を観測した。初回の配置/装着クリックそのものは計測していない。

通常のWキー600msで頭が約0.876m移動し、タグと頭の移動量の差は約0.066mmだった。停止後の頭領域上端との距離は約0.11988m。もう1台の状態はidleを保った。頭上タグはネイティブの鏡で観察したが、私有モデル画像はGitへ追加しない。[本番PC計測](native-tag-2026-10-25.json)

自動操作での視点旋回用PointerLockは引き続き失敗しているため、解除ボタンの手動操作を依頼中。解除状態とタグ消失は確認待ち。公式ローカルの成功から本番の解除を推測しない。

Quest、実複数人、他者視点、実VRM1、XRift本番IK、髪との接触、見た目の採用判定は未確認。今回のローカルVRM橋渡しはそれらを再現しない。

公式仕様: [ItemとDevEnvironment](https://docs.xrift.net/world-components/components/)、[アイテムの作り方](https://docs.xrift.net/item/create-first-item)、[設定](https://docs.xrift.net/item/configuration)。
