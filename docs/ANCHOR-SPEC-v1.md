# Avatar Attachment 基礎規格 v1

2026-10-25 / このリポジトリの実験規格。XRift公式規格・Marketplace対応済みという意味ではありません。

## 目的と境界

頭上タグ、帽子、胸のバッジ、手の小物を、同じ追従計算とモデル別補正で扱います。頭頂の自動認識や、すべてのモデルへ一律に合う帽子は保証しません。**追従計算と、見た目の装着位置合わせを分離**します。

| 層 | 入力と責任 | 実装 |
|---|---|---|
| 対象取得 | 装着者と現在のモデルを特定し、部位のObject3Dを渡す | 明示bone map、VRMアダプター、保守的XRift頭探索 |
| 補正 | 同じモデル・小物・部位の補正だけを選ぶ | profile v1 / exact-match resolver |
| 追従 | 更新済みの骨から小物の姿勢を計算する | updateAnchor / createAnchor |
| 内容 | タグ、帽子、小物の形と支点を作る | 呼出側の子Object3D |
| 状態共有 | 装着者・ステータス・補正の同期 | 本実験では未実装 |

`userId` は人の識別、`avatarId` はモデルと座標系の識別です。同じ人のモデル変更ではavatarIdを変えます。骨名の推測で部位を決めるより、humanoidの意味付きマップを優先します。

## 座標と計算

- Three.jsの右手座標系、+Yが上、距離はワールドのメートル単位です。
- `offset: [x,y,z]` は**骨原点から小物の支点まで**の補正です。骨原点は頭頂や髪の表面とは限りません。
- `offsetSpace: 'world'` はワールド軸。`'bone'` は渡した骨の回転軸です。`'head'` は旧設定互換のbone別名です。
- bone補正は回転だけを受けます。アバターや親の倍率を掛けません。体格変更で帽子を自動拡縮せず、補正と小物サイズを再確認します。
- `rotationMode: 'world-up'` は、追加回転を適用する前の基準が単位Quaternion（水平・向き固定）です。頭のyawだけを追う機能ではありません。
- `'bone'` は骨のワールド回転、`'camera-facing'` は呼出側が渡した観察カメラのQuaternionです。`'head'` はbone別名です。
- `rotationOffset?: [x,y,z,w]` は表示物の追加回転Quaternion。ゼロ長を拒否し、単位化します。適用順は基準回転 × 追加回転です。
- `scale` は表示グループの一様なワールド倍率です。表示物はあらかじめメートルで作ります。

骨のワールド原点をp、回転をq、補正をoとすると、world補正は `P=p+o`、bone補正は `P=p+q(o)`。表示回転Rと倍率sを合成したWに対し、表示物の親がある場合は `L=inverse(parent.matrixWorld)*W` をローカル姿勢へ適用します。

VRM 0/1やraw/normalizedの骨について、同じローカル+Zを「顔の前」と仮定しません。profile v1のbone補正は渡された骨の軸に属します。rawとnormalizedを切り替える場合はavatarIdも分け、再校正してください。

ブラウザの実VRM0表示は `VRMUtils.rotateVRM0` で正面をそろえ、avatarIdに `:vrm0-forward-v1` を含めます。GLB元座標を使う数値マトリクスとは座標系が違うため、profileを混用しません。

## 小物の支点

コアが制御するのは専用の空グループです。見た目はその子に置き、子の形状・位置を勝手に変更しません。

| 用途 | 初期の選択 | 調整すること |
|---|---|---|
| 読むためのタグ | world補正、world-upまたはcamera-facing | 頭頂/髪からの余白、文字の大きさ |
| 被りもの | bone補正、bone回転 | 頭頂までの補正、骨軸と帽子の向き、帽子の大きさ |
| 胸バッジ | chest、bone補正/回転 | 衣服の表面位置と正面方向 |
| 手の小物 | leftHand/rightHand、bone補正/回転 | 持ち手の支点、握りの向き |

帽子の底面・小物の握り位置を子形状の原点にすると、装着補正を理解しやすくなります。コアの初期値 `[0,0.22,0]` はプローブ用で、全モデルへ採用する値ではありません。

デモの「中立姿勢の上向きに合わせる」は明示押下でのみ参考補正を作ります。中立姿勢のモデル全体のバウンディングボックス上端を参照し、帽子は15mm、タグは120mmの余白を置きます。帽子は中立骨の逆回転で補正ベクトルと追加回転を作り、以後の頭回転へ追従させます。胸・手は8cm上への仮置きです。サンプリング後に制御中の姿勢へ戻します。

これはコア規格の自動装着条件ではありません。上端には髪・装飾・腕などが入り、帽子の大きさや支点の前後左右は推定しません。動作中に浮く・離れる場合もあります。`referenceCalibration.requiresVisualReview: true` と前後計測を表示に残し、人の装着判定へ使います。参考補正を別のアバター倍率へ自動適合させません。

## profile v1

```json
{
  "schema": "xrift-avatar-anchor.profile",
  "version": 1,
  "avatarId": "example-model:raw:revision-1",
  "attachmentId": "hat:head",
  "bone": "head",
  "settings": {
    "offset": [0, 0.2, 0],
    "offsetSpace": "bone",
    "rotationMode": "bone",
    "rotationOffset": [0, 0, 0, 1],
    "scale": 1
  }
}
```

これは説明用の値で、実VRMの採用済み補正ではありません。

- 識別キーは `avatarId + attachmentId`。`bone` は追加の一致条件です。同じ小物を別部位で使うなら `hat:head` / `hat:leftHand` のようにattachmentIdを分けます。
- avatarIdはモデル更新と座標系が区別できる安定IDを使います。ローカルデモではファイルSHA256を使用。V01等の表示順だけでは保存キーにしません。
- `bone` は既知のhumanoid役割（head/chest/leftHand等）。任意の非人型ノードはupdateAnchorへ直接渡せますが、v1 profileの役割には含めません。
- resolverは一致が0件ならmissing-profile、複数ならambiguous-profile、部位違いならbone-mismatch。異なるモデルの値を自動転用しません。
- schema/version不一致、非有限の数値、正でないscale、未知の役割・モードは拒否します。
- JSONは数値補正だけです。モデル本体、モデルの実ファイル名、作者情報、認証情報、ステータス共有情報を保存しません。
- 自動永続保存は行いません。デモのメモリ内補正は再読込で消えるため、必要なprofileをJSONで保存します。

## フレーム更新と解除

```js
import {createAnchor, resolveAttachmentProfile} from './src/index.mjs'
import {selectVRMBone} from './src/adapters/vrm.mjs'

const controller = createAnchor(attachmentGroup)
// ホストのアニメーション・IK・VRM姿勢更新が終わった後、描画前に呼ぶ。
function follow() {
  const calibration = resolveAttachmentProfile(profiles, {
    avatarId, attachmentId: 'hat:head', bone: 'head'
  })
  const source = selectVRMBone({vrm, bone: 'head', space: 'raw'})
  attachmentGroup.visible = false
  if (calibration.status !== 'ready' || source.status !== 'ready') return
  try {
    controller.update({bone: source.bone, settings: calibration.profile.settings})
    attachmentGroup.visible = true
  } catch (error) {
    // 保留理由を調整画面へ出す。直前の位置に表示を残さない。
    reportPending(String(error))
  }
}
// 解除/モデル交換/退室時。フレーム更新を止め、表示を隠して元のローカル姿勢へ戻す。
function detach() { attachmentGroup.visible = false; controller.dispose() }
```

追従処理からカメラ、入力、VRMの骨、他人の小物を変更してはいけません。同じ小物を2つの制御系で更新しないでください。disposeは元のローカル姿勢を戻しますが、可視性・親の付替え・GPU資源の破棄は呼出側の責任です。例のprofiles/avatarId/vrm/reportPendingはホストから渡す値です。

コアは即時の姿勢計算で、補間・ネットワーク遅延補償は含みません。追従の遅れはホストの更新順や実機で別に測ります。

## 対応する変換と保留条件

位置・回転・一様な拡縮、表現可能な非一様TRSは扱います。shear（せん断）がある骨/親/必要ローカル変換、反転したsource、特異行列、非有限値、骨自身や祖先を表示物にする循環を拒否します。対象への適用前に検査します。targetのmatrixWorldAutoUpdateはtrueが必要です。

この制約を無視して、見た目がずれたまま成功扱いにしません。未対応時は呼出側が非表示と保留理由を出します。リグやカメラは再親付けしません。

## XRift接続の境界

### 自動調整タグの実装

`src/overhead.mjs` の `estimateHeadTop` は、明示headと所有avatarRootを受け、頭または子ボーンの影響が0.5以上のスキン頂点を最大6,000個採ります。CPUスキニングとmorphを通した現在の頭領域の上端に余白を加えます。骨を中立へ戻す操作は行いません。全身や他人のBBoxを使わず、頭のジオメトリを得られなければ保留します。completeは全頂点を採れた意味で、視覚適合の合格を表しません。

`src/adapters/xrift-runtime.mjs` は、同じ頭を共有する複数メッシュをまとめ、remote-playerマーカーの対象を分離します。sourceは明示root／ローカル未所属骨格／リモートマーカーを区別します。UUIDによるidentityは現在の実行中リグの識別で、永続profileのモデルIDには使いません。対象削除・骨格交換でキャッシュを無効化し、定期再走査で新しい曖昧さも検出します。

配布例は `item/overhead-tag`。配置IDは現SDKの `useItem().id` を使い、共有状態とインタラクトIDを配置ごとに分けます。共有JSONは正規化してから使います。形状の再採寸は約0.35秒周期、追従位置は毎フレーム更新します。描画直前にも表示物だけを合わせ、カメラや骨には書き込みません。頭の形状・向きが急変した直後の採寸待ちと、髪/間引き由来の概算は残ります。

公式ローカル環境の利用範囲は [アイテムREADME](../item/overhead-tag/README.md)、実測は [SDK検証JSON](experiments/official-sdk-item-2026-10-25.json) と [実VRM検証JSON](experiments/official-sdk-real-vrm-2026-10-25.json) を参照してください。

`selectXRiftBone` は、ホストが所有者と対応付けた `avatarRoot + bones` を受け取る入口です。部位がroot外なら拒否します。userIdとavatarRootの対応を保証する機能ではありません。

従来の `selectXRiftHead` の名前・remote-playerマーカー探索は保守的な補助で、ホストの慣習に依存します。候補が曖昧なら表示を保留します。手や胸は名前探索をせず、明示mapがなければwaiting-for-bone-mapです。

2026-10-25に確認した [XRift useUsers公式リファレンス](https://docs.xrift.net/world-components/components/#useusers) はユーザー/移動/高さを説明していますが、アバターObject3D取得を列挙していません。高さ+余白の公式HUD例は、骨や髪へ正確に装着する保証とは扱いません。VRMのraw/normalized取得と更新順は [three-vrm VRMHumanoid](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMHumanoid.html) を参照しました。

## 判定と実験証拠

数値合格は位置誤差1mm以内、回転誤差1e-5rad以内、スケール誤差1e-6以内、設定JSON往復、骨/カメラの不変です。視覚合格は頭頂/髪への適合・めり込み・文字の可読性を別に判断します。

証拠は自作骨格の数値、実VRM metadataの数値、ブラウザの実モデル描画、PC実XRift、Quest、他者視点に分けます。1層の成功を他の層へ昇格させません。

詳細は [数値マトリクス](experiments/MATRIX-2026-10-25.md)、[現状](STATUS.md)、[実験手順](EXPERIMENTS.md) を参照してください。
