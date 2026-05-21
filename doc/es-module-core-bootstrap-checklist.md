# ES Module Core Bootstrap Checklist

最後更新：2026-05-21（Asia/Taipei）

## 目的

本文件固定 `src/ui.js` / `src/game.js` 進入正式 ESM module scope 前的阻塞點與最小啟用順序。現階段 `module-shadow` 只允許 import 已完成 dual-mode 的 shell；不得直接啟用 `module` mode，也不得讓 `game.js` 在未完成 checklist 前接管 gameplay bootstrap。

## Current Baseline

- `src/main.js` 預設仍使用 legacy concatenated loader。
- `src/main-module.js` 已可 native import platform/runtime、state registry、DOM、UI shell、leaf services、catalog/media/stats、runtime helpers 與 game shell。
- `src/main-module.js` 可 import `src/game.js` 的 `gameShell`；`module-shadow` 仍不得呼叫 `bootstrapGame()`，正式 `module` 路徑由 `loadModuleGame()` 呼叫。
- Production build 已決定維持 `bundled-legacy-fallback`；`dist/build-asset-manifest.json` 的 `moduleLoader` 區塊與 `check:assets` 會固定此策略。
- Phase D 已開始 service module migration 小切片；`state.js` controls storage、`ui.js` controls helper / registry self-reads、`stats.js` root state、`about.js`、`network.js`、`audio.js`、`characters.js`、`replay.js`、`ai.js`、`render.js` 與 `game.js` 已集中 dependency aliases，後續可逐步替換成 explicit imports。
- `npm.cmd run audit:globals` 維持 44 cross-file reads；新增的 `network.js -> HexSnakeUI` 是 LAN service registry 註冊讀取，`state.js -> HexSnakeRuntime` 是 controls keybind storage alias，`game.js` 已不再讀 `window.HexSnakeNet`，`state.js` 已不再讀 `window.HexSnakeStorage`；`npm.cmd run audit:state-boundary` 維持 0/0。

## Module Blockers

| File | Blocker | Required before import in module mode |
| --- | --- | --- |
| `src/ui.js` | 仍以 top-level side effects 建立 config/state accessors、`HexSnakeUI` facade 與 UI presentation helpers | 已提供 `uiCore` / `HexSnakeUICore` shell；module-shadow import 後只註冊 facade，不啟動 gameplay |
| `src/ui.js` | 依賴 `HexSnakeRuntime.storage`、`HexSnakeDOM`、`HexSnakeControls`、`HexSnakeRender` 與 `HexSnakeUI` shared registry | 先明確記錄 import order，再逐步改成 explicit imports 或保持 window compatibility gate |
| `src/game.js` | import 時曾綁定大量 DOM/window listeners、註冊 `HexSnakeRenderGame` / `HexSnakeUI.*Game` hooks，並立即呼叫 `bootstrap()` | 已拆出 `loadGameShell()` 與 `bootstrapGame()`；module-shadow 只驗證 shell，正式 module owner 才能啟動 |
| `src/game.js` | gameplay bootstrap 同時載入 balance、AI strategy、character database、settings、HUD、replay/effect comparison 與 first render | bootstrap 必須保留 async error path，並建立 module-mode boot failure UI，不得靜默 fallback |
| `src/game.js` | 已提供 formal ESM export，legacy default 仍自動呼叫 bootstrap | 已由 `main-module.js` / `main.js` 建立正式 `module` 路徑的唯一 bootstrap owner |

## Explicit Import Surface

`src/ui.js` 的最小 module shell 應只依賴：

- `runtime` / `storage` from `src/platform/web.js` 或 mobile target adapter。
- `state`、`uiRegistry`、`render`、`controls` from `src/state.js`。
- `dom` from `src/dom.js`。

`src/game.js` 的最小 module shell 應只依賴：

- `runtime`、`state`、`uiRegistry`、`render`、`renderGame`、`controls`、`dom`（目前由 `Game*` aliases 集中）。
- service shells: `network`、`audio`、`replay`、`stats`、`about`、`ai`、`renderHooks`。
- catalog shell: `characterCatalog`。

## Bootstrap Ownership

1. `src/game.js` must not call `bootstrapGame()` at module evaluation time when `hexSnakeLoader=module-shadow`.
2. `loadGameShell()` registers event listeners and game facades once, guarded against duplicate registration.
3. `bootstrapGame()` owns async startup and returns a contract with `bootstrapsGameplay: true`.
4. `legacy` mode must keep existing behavior until module mode has browser/mobile smoke coverage.
5. `module-shadow` may import `ui.js` and `gameShell`; it must not call `bootstrapGame()` until formal module mode is enabled.

## Module Mode Preflight

Before enabling formal `module` mode, run:

```bash
npm.cmd run audit:esm-map
npm.cmd run audit:globals
npm.cmd run audit:state-boundary
npm.cmd run build
npm.cmd run build:mobile
npm.cmd run test:module-loader
npm.cmd run test:quick
npm.cmd run test:smoke
```

Also run `npm.cmd run test:module-loader` after each loader step. The source `module-shadow` contract must keep `bootstrapsGameplay: false`; source `module` must set `__HEX_SNAKE_MODULE_GAME__`; dist `module-shadow` / `module` must keep using bundled legacy fallback until production module mode is intentionally enabled.

## Next AI Task

下一個 AI 可直接處理項目是延續 Phase D service module migration：盤點剩餘 direct window/facade reads，挑下一個 low-risk helper 或 import preflight 小切片；production default 繼續維持 `bundled-legacy-fallback`。
