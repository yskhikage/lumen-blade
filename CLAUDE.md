# LUMEN BLADE — notes for Claude

Browser 3D action game (three.js + VRM characters) played on iPhone Safari with a PS5 controller.
The owner mostly develops from an iPhone via Claude Code; replies to them in Japanese.

## Commands
- `npm install` / `npm run dev` / `npm run build` (must pass before pushing)
- `npm run typecheck` — most files still start with `// @ts-nocheck`; remove it file by file while adding types.
- Deploy: push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub Pages.

## Architecture
- `src/game.ts` is still a large single module holding shared mutable state (hero, enemies, boss, cine, lockTarget, mode, wave…).
  When splitting it further, move shared state into one exported state object rather than exporting `let` variables.
- Characters are VRM (`public/models`). Poses are Euler angles on *normalized* bones in VRM1 axes; VRM0 models are mirrored
  at runtime by negating x/z (`H.sign`). The sword is aimed each frame by rotating `rightHand` so the blade points along `bladeDir`.
- Joints are driven by critically-damped springs (`spring()` / `FREQ`); attacks sample keyframes from `ATK` in `motion/poses.ts`.
- Story: `STORY` steps (scene / battle / boss / end) in `game.ts`, dialogue text in `story/scenes.ts`.

## Conventions
- Keep everything working on iPhone Safari: watch fill-rate (bloom, transparent planes) and keep DPR ≤ 1.5.
- Gamepad uses the standard mapping (0 ✕, 1 ○, 2 □, 3 △, 4 L1, 5 R1, 9 OPTIONS, 11 R3).
- Only use assets whose license allows redistribution; record credits in README.md.
