# ブラウザで比較実験を再現する

先にリポジトリを作業ディレクトリにして `npm run dev` で127.0.0.1:5227を起動します。CLIの例:

```sh
npx --yes --package @playwright/cli playwright-cli -s=anchor-lab open http://127.0.0.1:5227/
npx --yes --package @playwright/cli playwright-cli -s=anchor-lab run-code --filename=scripts/check-demo.js
npx --yes --package @playwright/cli playwright-cli -s=anchor-lab run-code --filename=scripts/check-comparison.js
```

- `check-demo.js`: 旧補正JSON、小型条件、ステータス、回転等の6確認。
- `check-comparison.js`: 自作5条件、運動/停止、補正の分離、端数を含むJSON、v1 profile一致/不一致、帽子/頭・小物/手・タグ/胸、観察カメラ向き。ページを再読込して開始。
- `check-reference.js`: **現在表示しているモデル**へ参考補正を明示適用。中立姿勢の上端+15mm、基準回転、制御姿勢の復元、追従を確認。参考補正のrevisionを待ち、同じ姿勢を繰り返し採寸した再現性も確認。
- `check-local-vrms.js`: 先に画面のファイル選択でローカルVRMを3体同時読込してから実行。頭上タグ・帽子・胸タグ・左手小物×3倍率×3モデル=36計測。私有ファイル名はスクリプトに書かない。

```sh
npx --yes --package @playwright/cli playwright-cli -s=anchor-lab run-code --filename=scripts/check-local-vrms.js
npx --yes --package @playwright/cli playwright-cli -s=anchor-lab run-code --filename=scripts/check-reference.js
```

CLIが使えない場合、接続済みPlaywrightの `browser_run_code_unsafe` で同じ関数を実行できます。この作業ではCLIのChrome起動が失敗したため、その経路で確認しました。**MCPの作業ディレクトリはリポジトリと同じとは限りません。撮影の出力先はリポジトリ内の絶対パスへ置き換えてください。**

自作条件の画像は `docs/screenshots/`、私有VRMの画像はGit対象外の `artifacts/` へ保存します。後者の画像を前者へコピーしません。モデル読込はブラウザ内のファイル選択だけで、外部参照を持つVRMは拒否します。

`npm run verify` はこれらの実ブラウザ操作を含みません。数値マトリクスのmetadata検証と、GLTFLoader/three-vrmで実際に描画した検証を分けて報告します。
