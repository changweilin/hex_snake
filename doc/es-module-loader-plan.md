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
| `module` | future query flag / build flag | 直接 import ESM entry，由 entry 依 export map 初始化 runtime、state、DOM、services、render、game | dual-mode modules 完成後才啟用 |

## Source Order Contract

Native module loader 必須保持 `doc/es-module-export-map.md` 的初始化順序。第一批不得直接逐檔 `import("src/ui.js")`、`import("src/game.js")`，因為現有檔案仍依賴 legacy shared top-level scope。可接受的第一步是新增 module entry / shell，並讓 shell import 已完成 dual-mode 的 runtime / registry module。

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
| C. Dual-mode runtime / registry exports | platform/runtime、state registry、DOM facade、network/about leaf services、catalog/media/stats shell 與 runtime helper shell 已具備正式 named exports，module shadow 已 import 這些 shell；下一步盤點 `ui.js` / `game.js` core module blockers | `audit:esm-map`、`audit:globals` 不上升 |
| D. Service module migration | 依 export map 順序讓 leaf services 與 runtime helpers 改成 explicit imports，legacy loader 仍可回退 | build、quick、smoke、mobile |
| E. Gameplay module bootstrap | `src/game.js` 或新 bootstrap entry 接管 module mode；legacy loader 降為 fallback | release:check |

## Fallback Rules

1. `legacy` 永遠是 default，直到 module mode 通過 desktop/mobile smoke、offline、app readiness。
2. module mode 失敗時不得靜默切換成 legacy；開發期要顯示 boot error，避免誤判 module mode 已可用。
3. production build 不啟用 module mode，除非 release checklist 明確加入 module loader gate。
4. 每批只能移動一層 ownership：runtime/registry、DOM、leaf service、runtime helper、game bootstrap 不混批。

## Next AI Task

下一個 AI 可直接處理項目是 Phase C 下一段：盤點 `src/ui.js` / `src/game.js` 在正式 module scope 下的 blockers，先建立 core bootstrap checklist 或最小 shell 計畫；不得直接啟用 `module` mode 或移動 gameplay bootstrap。
