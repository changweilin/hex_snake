# ES Module Split Map

最後更新：2026-05-21（Asia/Taipei）

## 目標

本文件把 `npm.cmd run audit:globals` 的 legacy global dependency report 轉成 ES module split 的執行地圖，避免在正式拆分時一次碰到 `ui.js` / `game.js` / `render.js` / `ai.js` / `replay.js` 的核心循環依賴。

目前基線：
- `npm.cmd run audit:state-boundary`：`game.js` 對 `ui.js` top-level declaration 的 heuristic reference 維持 0，legacy name leak 維持 0。
- `npm.cmd run audit:globals`：42 cross-file reads。Phase 4 已把 replay、render、AI、UI/game hooks、public service 與 platform/storage runtime adapter 分批收斂到 facade；一般模組現在透過 `HexSnakeRuntime.platform/storage` 取用 runtime adapter。
- `src/main.js` 仍使用 legacy concatenated loader 載入 13 個 source files，尚未切到正式 module scope；`doc/es-module-export-map.md` 與 `npm.cmd run audit:esm-map` 已固定 registry 初始化順序與 export surface。

## Split Principles

1. 每一步都必須可 build、可 quick test、可 smoke test。
2. 先新增 script-compatible facade，再移動讀取點，最後才移除 legacy globals。
3. 不直接拆 `ui.js` / `game.js` 核心；先把 helper、DOM/state、service、runtime adapter 依賴收斂到 facade。
4. 每批變更後保留 `audit:state-boundary` gate，並讓 `audit:globals` cross-file reads 單調下降。

## Dependency Groups

| Group | Files | 現況 | Split 方向 |
| --- | --- | --- | --- |
| Foundation | `src/platform/web.js`, `src/platform/mobile.js`, `src/state.js`, `src/dom.js` | `state.js` 與 `dom.js` 沒有 detected cross-file globals；web/mobile platform 已註冊 `HexSnakeRuntime = { platform, storage }`，一般模組改走 `HexSnakeRuntime.platform/storage`；export map gate 已建立 | 先維持 script-compatible window facade；下一步規劃正式 module loader |
| Leaf services | `src/network.js`, `src/about.js` | `network.js` 改用 `HexSnakeRuntime.storage`；`about.js` 改用 `HexSnakeRuntime.platform`、`HexSnakeDOM` 與 `HexSnakeUI.about` | 可先抽成 isolated wrapper，保留 legacy global fallback |
| Catalog / media / stats | `src/characters.js`, `src/audio.js`, `src/stats.js` | catalog setter/list、portrait variant、food label 與角色 helper 已有 facade；`audio.js` / `stats.js` 分別註冊到 `HexSnakeUI.audio/stats`，runtime storage 改走 `HexSnakeRuntime.storage` | 補正式 catalog / service exports，再評估移除 window-only wiring |
| Runtime helpers | `src/ai.js`, `src/render.js`, `src/replay.js` | replay 已改走 DOM/state/UI facade 與 `HexSnakeUI.replayGame`；render draw/public hooks 已改走 `HexSnakeRender` 與 `HexSnakeRenderGame`；AI helper hooks 已改走 `HexSnakeUI.aiGame`；runtime adapter 改走 `HexSnakeRuntime` | 下一步不再新增零散 facade，先做 loader split 設計 |
| Core knot | `src/ui.js`, `src/game.js` | `ui.js -> dom.js` 與 `game.js -> dom.js` 都已收斂成 `HexSnakeDOM`；`ui.js -> game.js` 已改走 `HexSnakeUI.uiGame`；`game.js -> service/render/AI/runtime` 已改走 facade；registry init/export map 已文件化並可驗證 | 最後拆；先規劃 `src/main.js` module loader fallback |

## Recommended Split Order

| Phase | 狀態 | Work | Gate |
| --- | --- | --- | --- |
| 0. Boundary freeze | 完成 | 建立 `audit:state-boundary` gate，記錄 486 cross-file reads baseline | `audit:state-boundary` = 0/0 |
| 1. Low-risk module borders | 完成 | platform web/mobile、state、dom、network、about 建立 script-compatible facade 與 module borders | build、quick、smoke 通過；`audit:globals` 下降 |
| 2. DOM/helper facade | 完成 | 建立 `HexSnakeControls`、`HexSnakeDOM` 與 game/UI helper facade | `audit:globals` 486 -> 367 |
| 3. Catalog/media cleanup | 完成 | catalog setter/list、portrait variant state getter、food label config getter；characters/audio/stats 改走 facade | `audit:globals` 367 -> 339；build、quick、smoke 通過 |
| 4. Runtime cleanup | runtime adapter facade 收斂完成 | replay、render、AI、UI/game hooks、public services 與 platform/storage adapter 已分批改走 `HexSnakeDOM`、`HexSnakeState`、`HexSnakeUI`、`HexSnakeRender`、`HexSnakeRuntime` | `audit:globals` 339 -> 42；`audit:state-boundary` 維持 0/0 |
| 5. Core ES module split | registry/export map gate 建立完成 | 已新增 `doc/es-module-export-map.md` 與 `audit:esm-map`；下一步規劃 `src/main.js` loader split，保留 legacy loader fallback，再新增可切換 module loader | `audit:esm-map`、legacy loader 可回退；正式 loader 可逐步啟用 |

## Immediate AI Task Queue

1. 規劃 `src/main.js` loader split：先保留 legacy concatenated loader，再新增可切換的 module loader。
2. 依 `doc/es-module-export-map.md` 將 platform/runtime 與 registry modules 改成可被正式 ESM entry import 的 export 形狀。
3. 最後才處理 `ui.js` / `game.js` 的正式 module scope 拆分。

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
