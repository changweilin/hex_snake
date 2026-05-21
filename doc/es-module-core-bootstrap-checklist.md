# ES Module Core Bootstrap Checklist

最後更新：2026-05-21（Asia/Taipei）

## 目的

本文件固定 `src/ui.js` / `src/game.js` 進入正式 ESM module scope 前的阻塞點與最小啟用順序。現階段 `module-shadow` 只允許 import 已完成 dual-mode 的 shell；不得直接啟用 `module` mode，也不得讓 `game.js` 在未完成 checklist 前接管 gameplay bootstrap。

## Current Baseline

- `src/main.js` 預設仍使用 legacy concatenated loader。
- `src/main-module.js` 已可 native import platform/runtime、state registry、DOM、UI shell、leaf services、catalog/media/stats 與 runtime helpers。
- `src/main-module.js` 仍禁止 import `src/game.js`，因為 gameplay bootstrap ownership 尚未拆開。
- `npm.cmd run audit:globals` 維持 42 cross-file reads；`npm.cmd run audit:state-boundary` 維持 0/0。

## Module Blockers

| File | Blocker | Required before import in module mode |
| --- | --- | --- |
| `src/ui.js` | 仍以 top-level side effects 建立 config/state accessors、`HexSnakeUI` facade 與 UI presentation helpers | 已提供 `uiCore` / `HexSnakeUICore` shell；module-shadow import 後只註冊 facade，不啟動 gameplay |
| `src/ui.js` | 依賴 `HexSnakeRuntime.storage`、`HexSnakeDOM`、`HexSnakeControls`、`HexSnakeRender` 與 `HexSnakeUI` shared registry | 先明確記錄 import order，再逐步改成 explicit imports 或保持 window compatibility gate |
| `src/game.js` | import 時會綁定大量 DOM/window listeners、註冊 `HexSnakeRenderGame` / `HexSnakeUI.*Game` hooks，並立即呼叫 `bootstrap()` | 拆出 `loadGameShell()` 與 `bootstrapGame()`，讓 module entry 可以先驗證 shell，再由明確 owner 啟動 |
| `src/game.js` | gameplay bootstrap 同時載入 balance、AI strategy、character database、settings、HUD、replay/effect comparison 與 first render | bootstrap 必須保留 async error path，並建立 module-mode boot failure UI，不得靜默 fallback |
| `src/game.js` | 目前沒有 formal ESM export，只有 window/registry side effects 與 local `HexSnakeGame` frozen object | 補 `gameShell` / `HexSnakeGame` export 後，再允許 `main-module.js` 做 shadow import |

## Explicit Import Surface

`src/ui.js` 的最小 module shell 應只依賴：

- `runtime` / `storage` from `src/platform/web.js` 或 mobile target adapter。
- `state`、`uiRegistry`、`render`、`controls` from `src/state.js`。
- `dom` from `src/dom.js`。

`src/game.js` 的最小 module shell 應只依賴：

- `runtime`、`state`、`uiRegistry`、`render`、`renderGame`、`controls`、`dom`。
- service shells: `network`、`audio`、`replay`、`stats`、`about`、`ai`、`renderHooks`。
- catalog shell: `characterCatalog`。

## Bootstrap Ownership

1. `src/game.js` must stop calling `bootstrap()` at module evaluation time before it is imported by `module-shadow`.
2. A new exported shell function should register event listeners and game facades once, guarded against duplicate registration.
3. A separate exported bootstrap function should own async startup and return a contract with `bootstrapsGameplay: true`.
4. `legacy` mode must keep existing behavior until module mode has browser/mobile smoke coverage.
5. `module-shadow` may import `ui.js`; it must not call `bootstrapGame()` until formal module mode is enabled.

## Module Mode Preflight

Before enabling formal `module` mode, run:

```bash
npm.cmd run audit:esm-map
npm.cmd run audit:globals
npm.cmd run audit:state-boundary
npm.cmd run build
npm.cmd run build:mobile
npm.cmd run test:quick
npm.cmd run test:smoke
```

Also run a browser check against `?hexSnakeLoader=module-shadow` after each shell step. The contract must keep `bootstrapsGameplay: false` until `bootstrapGame()` is explicitly wired.

## Next AI Task

下一個 AI 可直接處理項目是將 `src/game.js` 的 shell registration 與立即執行的 `bootstrap()` 拆開，先提供 `gameShell` / `bootstrapGame()` exports；`module-shadow` 只能 import game shell，不得呼叫 `bootstrapGame()`。
