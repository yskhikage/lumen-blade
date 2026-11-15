# LUMEN BLADE

PS5コントローラー（DualSense）で遊べる、ブラウザ向け3Dアクションゲームの試作です。
iPhoneのSafariでそのまま動きます。

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
src/game.ts           ゲーム本体（描画・プレイヤー・敵・ボス・ストーリー進行・UI）
src/motion/poses.ts   キャラのポーズ・攻撃キーフレーム
src/story/scenes.ts   第1章の会話シナリオ
src/audio.ts          効果音（Web Audioで合成）
src/style.css         UIスタイル
public/models/*.vrm   キャラクターモデル
```

## クレジット

- 3Dモデル「Vita」（ルミナ役）「Victoria Rubin」（シエル役）: VRoid Project / pixiv Inc. — **CC0**
  （VRoid Studio β版サンプルモデル。テクスチャを1024pxに縮小して使用）
- [three.js](https://threejs.org/) (MIT), [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (MIT)
