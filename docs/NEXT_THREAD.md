# 次のスレッドへ

次の文をそのまま新しいスレッドへ渡せます。

> このリポジトリを起点に、小型アバターの頭上表示の前ずれを再現し、頭頂への位置合わせと調整UIを改善する実験を進めてください。まずAGENTS.md、README.md、docs/STATUS.md、docs/EXPERIMENTS.mdを読み、既存の検証を通してください。ローカルデモとXRift／Questの結果を区別し、1つの条件を再現してから改善し、前後の計測と判断をdocsへ残してください。元のhead-propeller-rideや公開アイテムへの反映はこの実験とは分けて扱ってください。

- GitHub: https://github.com/toM7x7/xrift-avatar-anchor
- 現在のローカル: D:/personal_dev/XRift/lab/xrift-avatar-anchor
- Node.js 22以上、npm ci → npm run dev。
- 用意する素材: A01（標準）、A02（前へずれた小型）、A03（別作者）の実VRM。まずA02を優先。
- VRMはローカルファイル選択で読み込む。リポジトリへ追加しない。
- 最初の狙いは「作業中／離席中」の読みやすい頭上表示。現段階では自動離席判定や状態同期は未実装。
- 新しいスレッドはこの資料を読むところから開始し、旧スレッドの記憶だけで完成・実機確認済みと扱わない。
