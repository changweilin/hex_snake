# ES Module Split Map

最後更新：2026-05-21（Asia/Taipei）

## 目標

本文件把 `npm.cmd run audit:globals` 的 legacy global dependency report 轉成 ES module split 的執行地圖，避免在正式拆分時一次碰到 `ui.js` / `game.js` / `render.js` / `ai.js` / `replay.js` 的核心循環依賴。

目前基線：
- `npm.cmd run audit:state-boundary`：`game.js` 對 `ui.js` top-level declaration 的 heuristic reference 維持 0，legacy name leak 維持 0。
- `npm.cmd run audit:globals`：42 cross-file reads。Phase 4 已把 replay、render、AI、UI/game hooks、public service 與 platform/storage runtime adapter 分批收斂到 facade；一般模組現在透過 `HexSnakeRuntime.platform/storage` 取用 runtime adapter。
- `src/main.js` 預設仍使用 legacy concatenated loader 載入 13 個 source files；local dev 可用 `?hexSnakeLoader=module-shadow` 載入 `src/main-module.js` shadow entry 並保持不啟動 gameplay，也可用 `?hexSnakeLoader=module` 由 `loadModuleGame()` 明確呼叫 `gameShell.bootstrapGame()`。

## Split Principles

1. 每一步都必須可 build、可 quick test、可 smoke test。
2. 先新增 script-compatible facade，再移動讀取點，最後才移除 legacy globals。
3. 不直接拆 `ui.js` / `game.js` 核心；先把 helper、DOM/state、service、runtime adapter 依賴收斂到 facade。
4. 每批變更後保留 `audit:state-boundary` gate，並讓 `audit:globals` cross-file reads 單調下降。

## Dependency Groups

| Group | Files | 現況 | Split 方向 |
| --- | --- | --- | --- |
| Foundation | `src/platform/web.js`, `src/platform/mobile.js`, `src/state.js`, `src/dom.js` | web/mobile platform 已 export `runtime` / `platform` / `storage`，`state.js` 已 export `state` / `uiRegistry` / `render` / `renderGame` / `controls`，`dom.js` 已 export `dom`，module shadow 已 import runtime/state/DOM shell | foundation shell exports 已完成 |
| Leaf services | `src/network.js`, `src/about.js` | `network.js` 已 export `network`，`about.js` 已 export `about`；module shadow 已 import leaf service shell，legacy `window.HexSnakeNet` / `window.HexSnakeAbout` 保留 | 已完成首批；後續等 module loader 啟用後再評估 window-only wiring |
| Catalog / media / stats | `src/characters.js`, `src/audio.js`, `src/stats.js` | `characters.js` 已 export `characterCatalog` / `HexSnakeCharacters`；`audio.js` / `stats.js` 分別 export `audio` / `stats`，並保留 `HexSnakeUI.audio/stats` registry 註冊；module shadow 已 import 這些 shell | 已完成；後續等 module loader 啟用後再評估 explicit imports |
| Runtime helpers | `src/ai.js`, `src/render.js`, `src/replay.js` | `replay.js` export `replay` / `HexSnakeReplay`；`ai.js` export `ai` / `HexSnakeAI`；`render.js` export `renderHooks` / `HexSnakeRenderHooks`；module shadow 已 import 這些 shell | 已完成；後續等 module loader 啟用後再評估 explicit imports |
| Core knot | `src/ui.js`, `src/game.js` | `ui.js` 已 export `uiCore` / `HexSnakeUICore`；`game.js` 已 export `gameShell` / `HexSnakeGame`、`loadGameShell()` 與 `bootstrapGame()`；`main-module.js` 已提供 `loadModuleGame()` 作為正式 module bootstrap owner | 下一步把 module loader 行為納入自動化 smoke gate |

## Recommended Split Order

| Phase | 狀態 | Work | Gate |
| --- | --- | --- | --- |
| 0. Boundary freeze | 完成 | 建立 `audit:state-boundary` gate，記錄 486 cross-file reads baseline | `audit:state-boundary` = 0/0 |
| 1. Low-risk module borders | 完成 | platform web/mobile、state、dom、network、about 建立 script-compatible facade 與 module borders | build、quick、smoke 通過；`audit:globals` 下降 |
| 2. DOM/helper facade | 完成 | 建立 `HexSnakeControls`、`HexSnakeDOM` 與 game/UI helper facade | `audit:globals` 486 -> 367 |
| 3. Catalog/media cleanup | 完成 | catalog setter/list、portrait variant state getter、food label config getter；characters/audio/stats 改走 facade | `audit:globals` 367 -> 339；build、quick、smoke 通過 |
| 4. Runtime cleanup | runtime adapter facade 收斂完成 | replay、render、AI、UI/game hooks、public services 與 platform/storage adapter 已分批改走 `HexSnakeDOM`、`HexSnakeState`、`HexSnakeUI`、`HexSnakeRender`、`HexSnakeRuntime` | `audit:globals` 339 -> 42；`audit:state-boundary` 維持 0/0 |
| 5. Core ES module split | module bootstrap owner 完成 | 已新增 `src/main-module.js` 與 `?hexSnakeLoader=module-shadow` / `?hexSnakeLoader=module`；platform/runtime、state registry、DOM facade、UI shell、network/about leaf services、catalog/media/stats、runtime helper 與 game shell 已可被 native module import；`module-shadow` 仍不呼叫 `bootstrapGame()` | `audit:esm-map`、legacy loader 可回退；正式 loader 可逐步啟用 |

## Immediate AI Task Queue

1. 擴充 browser smoke，分別驗證 `module-shadow` 不啟動 gameplay、`module` 可明確呼叫 `bootstrapGame()`。
2. 將 module loader smoke 納入固定 `audit:esm-map` / smoke gate 文件。
3. 再評估是否要讓 production build 加入 module-mode bundle 或繼續保留 legacy fallback。

## Do Not Start With

- 不直接把 `ui.js` / `game.js` 拆成 modules。
- 不把 `render.js` / `ai.js` / `replay.js` 剩餘 runtime reads 與 UI state 重新混在同一批大改動。
- 不把 DOM、game loop、AI decision 與 replay schema 放在同一個大改動中處理。

## Validation

每批變更至少執行：

```bash
npm.cmd run build
npm.cmd run audit:esm-map
npm.cmd run audit:globals
npm.cmd run audit:state-boundary
npm.cmd run test:quick
npm.cmd run test:smoke
```

接近 release 或 loader 行為變更時加跑：

```bash
npm.cmd run release:check
```
