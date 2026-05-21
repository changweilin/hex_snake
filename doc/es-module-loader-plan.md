# ES Module Loader Split Plan

最後更新：2026-05-21（Asia/Taipei）

## 目的

`src/main.js` 目前用 legacy concatenated loader，把 13 個 source files 合成同一個 Blob module 後再 `import()`。這讓各檔案仍能共享 top-level declarations，但也阻擋正式 ESM module scope。

本計畫固定 loader split 的分批方式：先保留 legacy loader 當預設與 fallback，再新增可切換的 native module loader；只有當 source files 具備 dual-mode export/import 形狀後，才允許 module loader 跑實際 gameplay bootstrap。

## Loader Modes

| Mode | Trigger | Behavior | Status |
| --- | --- | --- | --- |
| `legacy` | default | 使用現有 concatenated Blob loader；local web 載入 `src/platform/web.js`，build 依 target 換成 web/mobile platform source | 現行預設 |
| `module-shadow` | `?hexSnakeLoader=module-shadow` in local dev | 只驗證 native module entry 能載入 shadow contract，不啟動 gameplay bootstrap | 已建立 `src/main-module.js` |
| `module` | `?hexSnakeLoader=module` in local dev | 直接 import ESM entry，由 `loadModuleGame()` 呼叫 `gameShell.bootstrapGame()` 啟動 gameplay；production bundle 仍 fallback 到 legacy | local source mode 已可啟動 |

## Source Order Contract

Native module loader 必須保持 `doc/es-module-export-map.md` 的初始化順序。現階段只允許 import 已完成 dual-mode 的 shell；`src/game.js` 可被 shadow entry import `gameShell`，但不得呼叫 `bootstrapGame()`，因為 gameplay owner 仍必須由明確 module mode 啟動。

Shared order:

1. platform target: `src/platform/web.js` or `src/platform/mobile.js`
2. `src/state.js`
3. `src/dom.js`
4. `src/ui.js`
5. `src/network.js`
6. `src/characters.js`
7. `src/audio.js`
8. `src/replay.js`
9. `src/stats.js`
10. `src/about.js`
11. `src/ai.js`
12. `src/render.js`
13. `src/game.js`

## Implementation Phases

| Phase | Work | Gate |
| --- | --- | --- |
| A. Loader plan gate | 文件化 modes、fallback、source order，並讓 `audit:esm-map` 檢查本文件存在關鍵契約 | `npm.cmd run audit:esm-map` |
| B. Module shadow entry | 已新增 `src/main-module.js` 與 `?hexSnakeLoader=module-shadow`，只載入 shadow contract 並回報 ready，不啟動 gameplay | `audit:esm-map`、`build`、`test:smoke` |
| C. Dual-mode runtime / registry exports | platform/runtime、state registry、DOM facade、`uiCore` shell、network/about leaf services、catalog/media/stats shell、runtime helper shell 與 `gameShell` 已具備正式 named exports；module shadow 已 import shell，且不呼叫 `bootstrapGame()` | `audit:esm-map`、`audit:globals` 不上升 |
| D. Service module migration | 依 export map 順序讓 leaf services、runtime helpers 與 core shells 改成 explicit imports friendly shape，legacy loader 仍可回退；`state.js` controls storage、`ui.js` controls helper / registry self-reads、`stats.js` / `audio.js` / `replay.js` / `ai.js` / `render.js` root state、`about.js`、`network.js`、`characters.js` 與 `game.js` 已完成 dependency alias slices，集中 `State*` / `Ui*` / `Stats*` / `About*` / `Net*` / `Audio*` / `Character*` / `Replay*` / `Ai*` / `Render*` / `Game*` aliases；LAN service 已註冊 `HexSnakeUI.network`，game 不再讀 `window.HexSnakeNet`，controls keybind storage 不再讀 `window.HexSnakeStorage` | build、quick、smoke、mobile、network、`audit:esm-map` |
| E. Gameplay module bootstrap | `src/main-module.js` 已新增 `loadModuleGame()` 作為 module mode 唯一 bootstrap owner；`module-shadow` 仍只回報 contract；`test:module-loader` 已固定 source module / shadow 與 dist fallback checks；production strategy 已決定維持 `bundled-legacy-fallback` | `test:module-loader`、`check:assets`、release:check |

## Fallback Rules

1. `legacy` 永遠是 default，直到 module mode 通過 desktop/mobile smoke、offline、app readiness。
2. module mode 失敗時不得靜默切換成 legacy；開發期要顯示 boot error，避免誤判 module mode 已可用。
3. production build 維持 `bundled-legacy-fallback`，並由 `dist/build-asset-manifest.json` 的 `moduleLoader` 區塊與 `check:assets` 驗證；詳細策略見 `doc/es-module-production-strategy.md`。
4. 每批只能移動一層 ownership：runtime/registry、DOM、leaf service、runtime helper、game bootstrap 不混批。

## Production Strategy

目前正式決策是維持 `bundled-legacy-fallback`：`assets/app.bundle.js` 是 production entrypoint，`src/main-module.js` 只作為 source-mode 驗證入口。除非另新增 `module-bundle-source-map-release-gate`，不得把 production default 切到 module。

## Next AI Task

下一個 AI 可直接處理項目是延續 Phase D service module migration：`game.js` control-profile、saved character choice、keybind、attack button highlight、settings / perf overlay、settings clamp / GM parameters、GM presets / settings action、board geometry helper、reset game setup、result share helper、start logo countdown、skip logo transition、start game entry、auto start game、return to start screen、open game over character select、random food generation helper、update stock HUD helper、cooldown indicator helper、update HUD helper、replay snapshot throttle helper、auto battle speed menu helper、auto battle / relay control state、game-over relay settlement、network helper、sandworm status helper、turn/direction helper、attack stats / direction vector helper、lobster path / nearby cells helper、attack visual / circle projectile helper、Gu King / lobster volley helper、character big attack scheduler helper、launch attack helper、damage / vulnerability helper、attack stun / slow helper、vulnerability / collision paralysis helper、projectile resolver helper、projectile blast visual helper、game-over visual advance helper、hazard resolver helper、owner movement helper、replace consumed foods helper、step helper、step player-only helper、step computer-only helper、loop helper、pointer direction helper、control-pad attack pointer helper、move stick helper、target stick helper、opponent target helper、keyboard attack direction helper、keyboard attack hint helper、keyboard aim key helper、player direct attack helper、player attack failure helper、launch player attack helper、launch player attack direction helper、perform module attack helper、clear module hold helper、toggle pause helper、surrender game helper、board attack pointer helper、settings panel helper、platform back button helper、portrait interaction helper、setup input helper、reset best time / settings action button helper 與 attack button pointer / keyboard aim button helper slices 已改走 `GameRuntimeState` / `GameConfig` / `GamePresentationState` / `GameUI`，end game helper coverage 也已由既有 `audit:esm-map` guard 固定；下一輪可接續 rules / tutorial launcher direct facade reads，production default 繼續維持 `bundled-legacy-fallback`。
