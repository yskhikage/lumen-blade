# WindShield（ウインドシールド）

風が人々の暮らしと文明を支える世界を舞台にした、ストーリー重視のファンタジーRPGの試作です。
PS5コントローラー（DualSense）またはタッチ操作で遊べ、iPhoneのSafariでそのまま動きます。
（旧タイトル「LUMEN BLADE」の3Dアクションをベースにしているため、リポジトリ名は lumen-blade のままです）

## ストーリー

**第1話「風の沈黙」** — 聖都アウリスで巫女を務める少女エルフィナは、ある日、風の声を聞けなくなる。

- ストーリーモード：第1話（会話・歩くパート・戦闘・風の演出）
- エンドレスモード：ウェーブ制の戦闘

▶ **プレイ:** https://yskhikage.github.io/lumen-blade/

## 遊び方

| 操作 | コントローラー | キーボード |
|---|---|---|
| 移動 | 左スティック | WASD |
| カメラ | 右スティック | 矢印キー |
| 攻撃（3段コンボ） | □ / R1 | J |
| ジャンプ | ✕ | Space / K |
| 回避（ギリギリでJUST DODGE） | ○ | L / Shift |
| 必殺技（ゲージMAX） | △ | I |
| ロックオン / 切替 | R3・L1 / 右スティックを倒す | F / Q・E |
| ポーズ | OPTIONS | Esc |

iPhoneにDualSenseをBluetoothで接続し、ゲーム画面でどれかボタンを押すと認識されます。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173 （--host 付きなので同じWi-FiのiPhoneからも開けます）
npm run build    # dist/ に本番ビルド
```

`main` に push すると GitHub Actions が自動でビルドし、GitHub Pages に公開します。

## 構成

```
index.html            画面のHTML（HUD・会話ウィンドウ・メニュー）
src/main.ts           エントリーポイント
src/game.ts           ゲーム本体（描画・アースファン・風の演出・プレイヤー・敵・ストーリー進行・UI）
src/motion/poses.ts   キャラのポーズ・攻撃キーフレーム
src/story/scenes.ts   第1話の台本（話し手・カメラ・表情・風の演出）
src/audio.ts          効果音・風の環境音（Web Audioで合成）
src/style.css         UIスタイル
public/models/*.vrm   キャラクターモデル
public/textures/      大理石・岩肌の写真スキャン素材（Poly Haven）
public/hdri/          ライティング用の昼空HDR（Poly Haven）
public/sky/           背景の空（HDRIをJPGに変換したもの）
```

## クレジット

- 3Dモデル「Vita」（エルフィナ役）「Victoria Rubin」（若い神官役）: VRoid Project / pixiv Inc. — **CC0**
  （VRoid Studio β版サンプルモデル。テクスチャを1024pxに縮小して使用）
- [three.js](https://threejs.org/) (MIT), [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (MIT)
- テクスチャ「Marble 01」「Castle Wall Slates」、HDRI「Kloofendal 48d Partly Cloudy (Pure Sky)」: [Poly Haven](https://polyhaven.com/) — **CC0**
  （テクスチャ・ライティングは1k解像度。空の背景はHDRIを2048×1024のJPGに変換して使用）
