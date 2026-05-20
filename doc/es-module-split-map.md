# ES Module Split Map

更新日期：2026-05-21（Asia/Taipei）

## 目的

這份文件把 `npm.cmd run audit:globals` 的 legacy global dependency report 轉成 ES module split 的執行順序。目標是在不改玩法行為的前提下，先拆低風險邊界，再處理 `ui.js` / `game.js` / `render.js` / `ai.js` / `replay.js` 的核心循環。

目前基準：

- `npm.cmd run audit:state-boundary`：`game.js` 對 `ui.js` top-level declaration 的 heuristic reference 已歸零。
- `npm.cmd run audit:globals`：206 cross-file reads，Phase 4 已先把 `replay.js` 的直接 DOM/runtime reads、`render.js` 對 `ui.js` 的直接 DOM/runtime/config-catalog reads，以及 `ai.js` 的規則/runtime/helper reads 收斂到 `HexSnakeDOM`、`HexSnakeState`、`HexSnakeUI`。
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
| Catalog / media / stats | `src/characters.js`, `src/audio.js`, `src/stats.js` | 直接 state / DOM reads 已收斂；`audio.js` / `stats.js` 對 `ui.js` 的剩餘 audit 項多為 asset path 或 record 欄位名稱的 heuristic false-positive | 第二階段首輪完成，後續只需在正式 ESM 前確認 catalog function exports |
| Runtime helpers | `src/ai.js`, `src/render.js`, `src/replay.js` | `replay.js` 首批已改走 DOM/state/UI facade；`render.js -> ui.js` direct reads 已清空，只剩對 state/dom/ui facade 與 game/ai helpers 的依賴；`ai.js -> ui.js` direct reads 已清空，只剩對 state/ui facade 與 game facade 的依賴 | 下一步整理 core knot，優先釐清 `game.js -> ui.js` 剩餘設定/runtime state reads |
| Core knot | `src/ui.js`, `src/game.js` | `ui.js -> game.js` 目前只剩 `HexSnakeGame` facade read；`game.js -> dom.js` 直接 DOM globals 已收斂成單一 `HexSnakeDOM` | 最後拆；下一步降低 `game.js -> ui.js` 剩餘設定/runtime state reads |

## Recommended Split Order

| Phase | 狀態 | Work | Gate |
| --- | --- | --- | --- |
| 0. Boundary freeze | 完成 | `audit:state-boundary` 精修並歸零，固定 486 cross-file reads baseline | `audit:state-boundary` = 0/0 |
| 1. Low-risk module borders | 首輪完成 | 已為 platform web/mobile、`state.js`、`dom.js`、`network.js`、`about.js` 建立 script-compatible window/facade 邊界；`dom.js` 新增 `HexSnakeDOM` facade；未改 runtime call sites | build、quick、smoke 通過；`audit:globals` 不上升 |
| 2. DOM/helper facade | 完成 | 已新增 `HexSnakeControls`，讓 `keyLabel`、`loadKeybinds`、`normalizeAutoBattleSpeed` 不再由 `ui.js` 讀 `game.js`；`game.js` 所有直接 DOM globals 已改走 `HexSnakeDOM` | `ui.js -> game.js` 僅剩 `HexSnakeGame`；`game.js -> dom.js` 僅剩 `HexSnakeDOM`；`audit:globals` 486 -> 367 |
| 3. Catalog/media cleanup | 首輪完成 | 已新增 catalog setter/list facade 與 portrait variant state getter，並將 `characters.js`、`audio.js`、`stats.js` 的直接 state / DOM reads 改走 `HexSnakeState` / `HexSnakeUI` / `HexSnakeDOM` | `audit:globals` 367 -> 339；build、quick、smoke 通過 |
| 4. Runtime cleanup | ai 首批完成 | `replay.js` 已改走 `HexSnakeDOM`、`HexSnakeState.game/ui/replay` 與 `HexSnakeUI` facade；`render.js` 的 DOM refs、rafId、board-shake state、visualLoadScale cells read、colors / food / character catalog、elemental sprite cache、攻擊視覺常數、board collections、cell geometry 與 attack preview state 已改走 facade；`ai.js` 的 board cache、food/resource valuation、visibility memory、attack target/profile、projectile/hazard threat reads 已改走 `HexSnakeState.config/game` 與 `HexSnakeUI` | `audit:globals` 339 -> 206；`audit:state-boundary` 維持 0/0 |
| 5. Core ES module split | 待辦 | 在循環讀取清乾淨後，才拆 `ui.js` / `game.js` 本體與 `src/main.js` loader | legacy loader 可移除或降為 fallback |

## Immediate AI Task Queue

1. Phase 4 下一批：回頭拆解 `game.js -> ui.js` 剩餘設定/runtime state reads，先處理可直接改走 `HexSnakeState` / `HexSnakeUI` 的項目。
2. 判斷 `audit:globals` 中剩餘 `game.js -> ui.js` 項目哪些是真依賴、哪些只是 static heuristic false-positive。
3. 最後確認 `render.js` 對 `HexSnakeGame` / `HexSnakeAI` helpers 的依賴是否要改成更窄 facade。

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
