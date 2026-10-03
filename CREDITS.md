# 素材・音源

テトリスの音源の確認・制作日：2026年10月3日。実行時は同梱素材のみを使い、配布サイトへの音声直リンクはしません。

## テトリスの通常BGM

- 曲：コロブチカ（ロシア民謡）。音源制作・アレンジ：FC音工場。
- 元ファイル：`bgm_classic_etc_korobushka.wav`。手元の素材と[公式配布ファイル](https://fc.sitefactory.info/bgm.html)のSHA-256が一致。
- SHA-256：`17ee0d9d7925a06ff3c29875ca2a0e066e7993e52393f951dfb56e6456edc6a7`。
- 元WAV：`assets/bgm/tetris/bgm_classic_etc_korobushka.wav`。再生用：`korobushka-chip.mp3`。
- [利用規約](https://fc.sitefactory.info/kiyaku.html)：ゲーム等のコンテンツでの利用、商用利用、変換・加工が可能。著作権は放棄されていません。音源としての配布・販売、配布元音声・ZIPへの直リンク、作者の偽装は禁止。クレジット表記は任意です。本ゲームの素材として使用しており、音源素材集として再配布するものではありません。
- WAV末尾の512サンプルの余白を除き、64拍・25.6秒のループに整形。継ぎ目に1msの補正を加え、192kbps MP3に変換。原本は加工していません。
- 原素材の取得日：要確認。配布元・内容・利用条件の確認日：2026年10月3日。

## テトリスのオーケストラ風BGM

- 曲：コロブチカ（ロシア民謡）の主旋律を使った、本ゲーム用の独自編曲。編曲・打ち込み・ミックスは2026年10月3日にCodexで制作。
- 150 BPM、イ短調、32小節、51.2秒。弦楽合奏、フルート、ホルン、ピチカート低音弦、ティンパニ、小太鼓、シンバル。中間部、伴奏、楽器配置は新規制作です。公式ゲームの録音やMIDIは使用していません。
- 再生用：`assets/bgm/tetris/korobushka-orchestra.mp3`。制作WAV、音符データ `score.json`、使用サンプルの出典・ハッシュ `samples.json` を同じフォルダに保存。
- 楽器サンプル：[VS Chamber Orchestra 2 Community Edition](https://github.com/sgossner/VSCO-2-CE)。録音：Sam Gossner / Simon Dalzell。サンプル編集：Elan Hickler / Soundemote。CC0 1.0。原ライセンス：`assets/bgm/tetris/VSCO-CC0.txt`。
- 原曲の確認資料：[ロシア民謡コロブチカの譜面](https://commons.wikimedia.org/wiki/File:Korobeiniki.svg)（Public Domain Mark）。既存のピアノ・ゲーム編曲や録音から伴奏を複製していません。
- 制作・サンプル取得日：2026年10月3日。

## テトリスの効果音

[Kenney Digital Audio](https://kenney.nl/assets/digital-audio)、Kenney Vleugels作、CC0 1.0。商用利用・加工・再配布可。作者表記は必須ではありません。原ライセンス：`assets/se/tetris/KENNEY-CC0.txt`。取得日：2026年10月3日。

| 場面 | 元ファイル | 再生用WAV |
|---|---|---|
| 移動 | pepSound1.ogg | move.wav |
| 回転 | pepSound3.ogg | rotate.wav |
| ホールド | twoTone1.ogg | hold.wav |
| ハードドロップ | lowDown.ogg | drop.wav |
| 自然落下後の固定 | pepSound2.ogg | lock.wav |
| ライン消去 | threeTone1.ogg | clear.wav |
| 4ライン消去 | powerUp7.ogg | tetris.wav |
| ゲーム終了 | zapThreeToneDown.ogg | over.wav |

元OGGと変換WAVを `assets/se/tetris` に同梱。音声データは `games/tetris/sounds.js` にも埋め込み、`index.html` を直接開いても再生できます。このスクリプトはテトリスで音をオンにするまで読み込みません。

## 他のゲーム

ボール発射ゲームの効果音・ライブラリ：[既存のライセンス一覧](games/ball-launch/LICENSES.md)。
