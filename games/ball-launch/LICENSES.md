# ボール発射ゲームの素材・ライセンス

## 効果音

Kenney作。配布パックの `License.txt` でCC0を確認しています。

- [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)
  - `impactWood_medium_000.ogg` → `audio/wood1.wav`（木の衝突）
  - `impactWood_medium_002.ogg` → `audio/wood2.wav`（木の衝突）
  - `impactPlate_light_002.ogg` → `audio/plate.wav`（食器の軽い衝突）
- [RPG Audio](https://kenney.nl/assets/rpg-audio)
  - `knifeSlice.ogg` → `audio/launch.wav`（発射の風切り音）

音声はモノラル22,050 Hz、16-bit PCM WAVに変換しています。同じWAVを `audio/sounds.js` に埋め込み、ローカルファイルからでも音が鳴るようにしています。元音源の利用条件は同梱した `KENNEY-IMPACT-LICENSE.txt`、`KENNEY-RPG-LICENSE.txt` に保存。

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) は、商用利用・変更・再配布に対応し、作者表記は必須ではありません。記録のため作者と配布元を記載しています。

## 3Dライブラリ

- Three.js 0.180.0 — MIT、[公式リポジトリ](https://github.com/mrdoob/three.js)、全文は `vendor/THREE-LICENSE.txt`。
- cannon-es 0.20.0 — MIT、[公式リポジトリ](https://github.com/pmndrs/cannon-es)、全文は `vendor/CANNON-LICENSE.txt`。

両ライブラリを `vendor/engine.js` にまとめて同梱しています。実行時のCDNアクセスはありません。

## ゲーム画面

積み木、ボール、台、床はプリミティブから作成しています。参考チャット：[ゲーム例と遊び方紹介](https://chatgpt.com/share/6ac0a343-6510-83ee-b2d7-28be1c0633ea)。原作ゲームのモデル・キャラクター・音源は使っていません。
