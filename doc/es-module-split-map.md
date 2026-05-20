# ES Module Split Map

更新日期：2026-05-20（Asia/Taipei）

## 目的

這份文件把 `npm.cmd run audit:globals` 的 legacy global dependency report 轉成 ES module split 的執行順序。目標是在不改玩法行為的前提下，先拆低風險邊界，再處理 `ui.js` / `game.js` / `render.js` / `ai.js` / `replay.js` 的核心循環。

目前基準：

- `npm.cmd run audit:state-boundary`：`game.js` 對 `ui.js` top-level declaration 的 heuristic reference 已歸零。
- `npm.cmd run audit:globals`：467 cross-file reads，Phase 2 helper extraction 與 DOM facade 首批後的 current baseline。
- `src/main.js` 仍用 legacy loader 將 13 個 source files 合併到同一個 module scope。

## Split Principles

1. 每一階段都維持可 build、可 quick test、可 smoke test。
2. 先抽低反向依賴與 facade，再拆高循環檔案。
3. 不先拆 `ui.js` / `game.js` 本體；先移除它們之間的晚期 helper 依賴與直接 DOM/state 讀取。
4. 每次變更後保留 `audit:state-boundary` 歸零，並用 `audit:globals` 觀察 cross-file reads 是否下降。

## Dependency Groups

| Group | Files | 現況 | Split 判斷 |
| --- | --- | --- | --- |
| Foundation | `src/platform/web.js`, `src/state.js`, `src/dom.js` | `state.js`、`dom.js` 沒有 detected cross-file globals；`platform/web.js` 被多數檔案讀取，但仍有 `render.js` 的 late read `visualLoadScale` | 第一階段可先建立 export/facade 邊界；`platform/web.js` 的 late read 要在正式 split 前移除 |
| Leaf services | `src/network.js`, `src/about.js` | `network.js` 沒 detected consumers；`about.js` 只依賴 platform/dom 並由 `game.js` 使用 | 最適合先做 script-compatible wrapper 與 isolated verification |
| Catalog / media / stats | `src/characters.js`, `src/audio.js`, `src/stats.js` | 依賴 `ui.js` state、DOM 與少量 `game.js` facade | 第二階段處理，先把 catalog / portrait / audio 狀態收進 facade |
| Runtime helpers | `src/ai.js`, `src/render.js`, `src/replay.js` | 仍大量讀 `ui.js` runtime state，並依賴 `HexSnakeGame` | 不作為第一刀；等 DOM/state/helper facade 更完整後再拆 |
| Core knot | `src/ui.js`, `src/game.js` | `ui.js -> game.js` 目前只剩 `HexSnakeGame` facade read；`game.js -> dom.js` 的 HUD/status/target indicator direct reads 已先收進 `HexSnakeDOM` | 最後拆；下一步繼續用 `HexSnakeDOM` facade 降低 settings/control/modal DOM reads |

## Recommended Split Order

| Phase | 狀態 | Work | Gate |
| --- | --- | --- | --- |
| 0. Boundary freeze | 完成 | `audit:state-boundary` 精修並歸零，固定 486 cross-file reads baseline | `audit:state-boundary` = 0/0 |
| 1. Low-risk module borders | 首輪完成 | 已為 platform web/mobile、`state.js`、`dom.js`、`network.js`、`about.js` 建立 script-compatible window/facade 邊界；`dom.js` 新增 `HexSnakeDOM` facade；未改 runtime call sites | build、quick、smoke 通過；`audit:globals` 不上升 |
| 2. DOM/helper facade | 首批完成 | 已新增 `HexSnakeControls`，讓 `keyLabel`、`loadKeybinds`、`normalizeAutoBattleSpeed` 不再由 `ui.js` 讀 `game.js`；HUD/status/target indicator 已改走 `HexSnakeDOM` | `ui.js -> game.js` 僅剩 `HexSnakeGame`；`audit:globals` 486 -> 467 |
| 3. Catalog/media cleanup | 待辦 | 將 `characters.js`、`audio.js`、`stats.js` 對 `ui.js` 的直接 state reads 改走 `HexSnakeState` / `HexSnakeUI` / catalog API | catalog/audio/stats 不再依賴散落 UI globals |
| 4. Runtime cleanup | 待辦 | 將 `ai.js`、`render.js`、`replay.js` 的 runtime state reads 分批改走 facade | auto-battle、render、replay smoke 仍通過 |
| 5. Core ES module split | 待辦 | 在循環讀取清乾淨後，才拆 `ui.js` / `game.js` 本體與 `src/main.js` loader | legacy loader 可移除或降為 fallback |

## Immediate AI Task Queue

1. 繼續用 `HexSnakeDOM` facade，處理 `game.js` 的 settings/control/modal DOM reads。
2. 等 DOM facade gate 穩定後，才輪到 `characters.js` / `audio.js` / `stats.js`。
3. 保留 platform/state/dom/network/about 的 window/facade borders，之後實際轉 ESM 時再把這些 facade 改成 named exports。

## Do Not Start With

- 不先直接拆 `ui.js` / `game.js` 成獨立 modules。
- 不先拆 `render.js` / `ai.js` / `replay.js`，因為它們仍是 UI runtime state 的重度消費者。
- 不把 DOM、game loop、AI decision 與 replay schema 放在同一個大改動中處理。

## Validation

每一階段至少執行：

```bash
npm.cmd run build
npm.cmd run audit:globals
npm.cmd run audit:state-boundary
npm.cmd run test:quick
npm.cmd run test:smoke
```

release-adjacent 或 loader 相關階段再執行：

```bash
npm.cmd run release:check
```
