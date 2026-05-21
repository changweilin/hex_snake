# ES Module Split Map

最後更新：2026-05-21（Asia/Taipei）

## 目標

本文件把 `npm.cmd run audit:globals` 的 legacy global dependency report 轉成 ES module split 的執行地圖，避免在正式拆分時一次碰到 `ui.js` / `game.js` / `render.js` / `ai.js` / `replay.js` 的核心循環依賴。

目前基線：
- `npm.cmd run audit:state-boundary`：`game.js` 對 `ui.js` top-level declaration 的 heuristic reference 維持 0，legacy name leak 維持 0。
- `npm.cmd run audit:globals`：44 cross-file reads。Phase 4 已把 replay、render、AI、UI/game hooks、public service 與 platform/storage runtime adapter 分批收斂到 facade；一般模組現在透過 `HexSnakeRuntime.platform/storage` 取用 runtime adapter；LAN service 已註冊到 `HexSnakeUI.network`，`game.js` 不再讀 `window.HexSnakeNet`；controls keybind storage 已改走 `StateStorage`，`state.js` 不再讀 `window.HexSnakeStorage`。
- `src/main.js` 預設仍使用 legacy concatenated loader 載入 13 個 source files；local dev 可用 `?hexSnakeLoader=module-shadow` 載入 `src/main-module.js` shadow entry 並保持不啟動 gameplay，也可用 `?hexSnakeLoader=module` 由 `loadModuleGame()` 明確呼叫 `gameShell.bootstrapGame()`。

## Split Principles

1. 每一步都必須可 build、可 quick test、可 smoke test。
2. 先新增 script-compatible facade，再移動讀取點，最後才移除 legacy globals。
3. 不直接拆 `ui.js` / `game.js` 核心；先把 helper、DOM/state、service、runtime adapter 依賴收斂到 facade。
4. 每批變更後保留 `audit:state-boundary` gate，並避免新增散落 window/facade reads；`audit:globals` 仍用來監看 approved alias/registry 讀取是否可解釋。

## Dependency Groups

| Group | Files | 現況 | Split 方向 |
| --- | --- | --- | --- |
| Foundation | `src/platform/web.js`, `src/platform/mobile.js`, `src/state.js`, `src/dom.js` | web/mobile platform 已 export `runtime` / `platform` / `storage`，`state.js` 已 export `state` / `uiRegistry` / `render` / `renderGame` / `controls`，`dom.js` 已 export `dom`，module shadow 已 import runtime/state/DOM shell | foundation shell exports 已完成 |
| Leaf services | `src/network.js`, `src/about.js` | `network.js` 已 export `network` 並註冊 `HexSnakeUI.network`，`about.js` 已 export `about`；module shadow 已 import leaf service shell，legacy `window.HexSnakeNet` / `window.HexSnakeAbout` 保留 | 已完成首批；後續等 module loader 啟用後再評估 window-only wiring |
| Catalog / media / stats | `src/characters.js`, `src/audio.js`, `src/stats.js` | `characters.js` 已 export `characterCatalog` / `HexSnakeCharacters`；`audio.js` / `stats.js` 分別 export `audio` / `stats`，並保留 `HexSnakeUI.audio/stats` registry 註冊；module shadow 已 import 這些 shell | 已完成；後續等 module loader 啟用後再評估 explicit imports |
| Runtime helpers | `src/ai.js`, `src/render.js`, `src/replay.js` | `replay.js` export `replay` / `HexSnakeReplay`；`ai.js` export `ai` / `HexSnakeAI`；`render.js` export `renderHooks` / `HexSnakeRenderHooks`；module shadow 已 import 這些 shell | 已完成；後續等 module loader 啟用後再評估 explicit imports |
| Core knot | `src/ui.js`, `src/game.js` | `ui.js` 已 export `uiCore` / `HexSnakeUICore`，並集中 `Ui*` dependency aliases；`game.js` 已 export `gameShell` / `HexSnakeGame`、`loadGameShell()` 與 `bootstrapGame()`，並集中 `Game*` dependency aliases；`main-module.js` 已提供 `loadModuleGame()` 作為正式 module bootstrap owner | 下一步盤點剩餘 direct window/facade reads，不切 production default |

## Recommended Split Order

| Phase | 狀態 | Work | Gate |
| --- | --- | --- | --- |
| 0. Boundary freeze | 完成 | 建立 `audit:state-boundary` gate，記錄 486 cross-file reads baseline | `audit:state-boundary` = 0/0 |
| 1. Low-risk module borders | 完成 | platform web/mobile、state、dom、network、about 建立 script-compatible facade 與 module borders | build、quick、smoke 通過；`audit:globals` 下降 |
| 2. DOM/helper facade | 完成 | 建立 `HexSnakeControls`、`HexSnakeDOM` 與 game/UI helper facade | `audit:globals` 486 -> 367 |
| 3. Catalog/media cleanup | 完成 | catalog setter/list、portrait variant state getter、food label config getter；characters/audio/stats 改走 facade | `audit:globals` 367 -> 339；build、quick、smoke 通過 |
| 4. Runtime cleanup | service module migration 小切片進行中 | replay、render、AI、UI/game hooks、public services 與 platform/storage adapter 已分批改走 `HexSnakeDOM`、`HexSnakeState`、`HexSnakeUI`、`HexSnakeRender`、`HexSnakeRuntime`；`state.js` controls storage、`ui.js` controls helper / registry self-reads、`stats.js` / `audio.js` / `replay.js` root state、`about.js`、`network.js`、`characters.js`、`ai.js`、`render.js` 與 `game.js` 已集中 dependency aliases，`network.js` 已註冊 `HexSnakeUI.network` 供 game LAN hooks 取用，方便後續替換成 explicit imports | `audit:globals` 339 -> 44；`audit:state-boundary` 維持 0/0；`audit:esm-map` 固定 state/ui/stats/about/network/audio/characters/replay/ai/render/game alias/registry shape |
| 5. Core ES module split | production strategy 完成 | 已新增 `src/main-module.js` 與 `?hexSnakeLoader=module-shadow` / `?hexSnakeLoader=module`；platform/runtime、state registry、DOM facade、UI shell、network/about leaf services、catalog/media/stats、runtime helper 與 game shell 已可被 native module import；`test:module-loader` 固定驗證 shadow no-bootstrap、source module bootstrap 與 dist fallback；正式 production 決定維持 `bundled-legacy-fallback`，由 `check:assets` 驗證 manifest | `audit:esm-map`、`test:module-loader`、`check:assets`、legacy loader 可回退；正式 module bundle 須另走 source map gate |

## Immediate AI Task Queue

1. 延續 Phase D service module migration：盤點剩餘 direct window/facade reads，挑下一個 low-risk helper 或 import preflight 小切片，並維持 production `bundled-legacy-fallback`。
2. 若要啟動正式 module bundle，先依 `doc/es-module-production-strategy.md` 新增 opt-in module artifact / source map gate，不直接改 default。
3. 每批只移動一層 ownership，確保 `audit:globals`、`audit:state-boundary` 與 `test:module-loader` 不退步。

## Do Not Start With

- 不直接把 `ui.js` / `game.js` 拆成 modules。
- 不把 `render.js` / `ai.js` / `replay.js` 剩餘 runtime reads 與 UI state 重新混在同一批大改動。
- 不把 DOM、game loop、AI decision 與 replay schema 放在同一個大改動中處理。

## Validation

每批變更至少執行：

```bash
npm.cmd run build
npm.cmd run audit:esm-map
npm.cmd run test:module-loader
npm.cmd run audit:globals
npm.cmd run audit:state-boundary
npm.cmd run test:quick
npm.cmd run test:smoke
```

接近 release 或 loader 行為變更時加跑：

```bash
npm.cmd run release:check
```
