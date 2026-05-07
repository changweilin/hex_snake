# Follow-up Execution List

最後檢查：2026-05-07（Asia/Taipei）

這份清單只保留目前較值得排入後續開發的未完成事項。`doc/current-balance.md` 已刪除，平衡判斷請改以最新 `reports/` 輸出或重新執行模擬結果為準。

## Current Progress

- 已完成保守拆分 `index.html`
  - `index.html` 現在只保留 HTML 骨架、CSS link，以及 `src/main.js` 入口。
  - CSS 已搬到 `src/styles.css`。
  - JS 已拆成：
    - `src/main.js`：legacy loader，維持拆檔後仍在同一個執行 scope。
    - `src/state.js`：共用狀態入口，目前先接 `audio` / `replay` 低風險狀態。
    - `src/dom.js`：集中 DOM query。
    - `src/ui.js`：UI、HUD、設定面板、事件輔助。
    - `src/characters.js`：角色資料載入、角色選擇、立繪 URL / srcset。
    - `src/audio.js`：音效狀態、音效 profile、播放 facade `HexSnakeAudio`。
    - `src/replay.js`：重播紀錄、播放控制 facade `HexSnakeReplay`。
    - `src/ai.js`：電腦 / 自動對戰決策、食物目標評分、攻擊選擇。
    - `src/render.js`：主要畫布繪製、技能特效、蛇身、食物、projectile / hazard / blast 繪製。
    - `src/game.js`：核心流程、攻擊結算、移動、輸入事件、loop、bootstrap。
  - `build.js` 已更新，build 會複製 `src/` 到 `dist/src/`。
  - 已驗證：
    - 各拆分 JS 檔 `node --check` 通過。
    - 合併後語法檢查通過。
    - `npm.cmd run build` 通過。
    - in-app browser 載入、開始遊戲、settings、replay modal smoke test 無 console error。

- 已完成文件可讀性巡檢
  - `README.md` 與 `doc/*.md` 以 UTF-8 讀取時內容可讀。
  - `README.md` 已記錄 Windows PowerShell 5.x 預設 code page 可能讓 UTF-8 檔案看起來像亂碼，讀取時可改用 `-Encoding UTF8`。
  - 本次掃描 `README.md`、`doc/`、`src/`、`index.html` 未找到常見 mojibake 或 replacement character。
  - 後續若新增使用者可見文字或設計文件，只需列入例行檢查，不再作為 P0 未完成項。

- 策略最佳化流程已開始整理
  - `doc/strategy-optimization-sop.md` 已整理 quick/full profile、背景執行、進度檢查、完成檢查與套用門檻。
  - `tools/run-strategy-optimization.js` 工作區版本已加入 target-vs-baseline 的 side-balanced cross-play 協議，避免把全員同時換策略的零和矩陣誤讀成單一角色進步。
  - 目前最新完整可讀的同步高階 AI 對戰摘要是 `reports/sim-sync-cross20.md`。
  - `reports/strategy-quick-20260507-183526/` 目前尚未產生 `manifest.json` 或 `comparison.md`，不能視為完成訓練結果。

## P0

- 補 browser smoke test script
  - 範圍：新增一個簡單瀏覽器 smoke test，固定檢查首頁載入、開始遊戲、開 settings、開 replay modal。
  - 目標：後續繼續拆 `game.js` / 轉 ES modules 時，有快速保護網。
  - 驗收：可用 `npm.cmd run test:smoke` 或類似指令執行，失敗時輸出 console error 與失敗步驟。
  - 現況：`package.json` 尚未定義 `test:smoke`；目前只有手動 in-app browser smoke 記錄。

- 補齊策略最佳化新協議的完成產物
  - 範圍：用 target-vs-baseline cross-play 協議跑完至少 quick profile，並產生 `manifest.json` 與 `comparison.md`。
  - 目標：確認新版交叉驗證輸出可讀、可重跑，且 SOP 與實際工具一致。
  - 驗收：輸出目錄包含 `baseline-cross.*`、`best-cross.*`、`comparison.md`、`manifest.json`，且 `comparison.md` 能清楚列出每個角色的 marginal delta。

## P1

- 繼續收斂 `game.js`
  - 範圍：把剩餘核心邏輯再分成較小檔案，例如 `combat.js`、`movement.js`、`input.js`、`loop.js`。
  - 目標：讓 `game.js` 只負責 bootstrap 與高階流程協調。
  - 驗收：拆分後 build 與 smoke test 通過，遊戲開始、移動、攻擊、結束流程正常。

- 將 facade 轉成明確 API
  - 範圍：整理 `HexSnakeAudio`、`HexSnakeReplay`，後續補 `HexSnakeAI`、`HexSnakeRenderer`。
  - 目標：為真正 ES module `import/export` 做準備。
  - 驗收：外部呼叫點不再直接操作 replay/audio 內部變數。
  - 現況：`HexSnakeAudio` 與 `HexSnakeReplay` 已存在；`HexSnakeAI`、`HexSnakeRenderer` 尚未建立，`game.js` 仍直接呼叫多個全域函式。

- 補 replay 回歸測試
  - 範圍：建立可重複的 replay 記錄、播放、暫停、倒放、seek 測試。
  - 目標：避免 replay facade 或後續狀態整理造成回放壞掉。
  - 驗收：replay modal 和播放控制可以自動化驗證。

- 將策略最佳化 SOP 納入主要文件導覽
  - 範圍：確認 `README.md` 的相關文件區塊列出 `doc/strategy-optimization-sop.md`。
  - 目標：讓策略訓練、驗證與套用流程不只藏在 `doc/`。
  - 驗收：README 導覽與 SOP 內容一致，且 quick/full 指令可從專案根目錄直接執行。

## P2

- 轉真正 ES modules
  - 範圍：逐步移除 `src/main.js` 的 `eval` loader，改成 `import/export`。
  - 目標：讓模組邊界由語言層級保護，而不是只靠載入順序。
  - 驗收：`<script type="module" src="src/main.js">` 直接 import 各模組，無 global scope 隱性依賴。

- 拆分 `render.js`
  - 範圍：把大型特效函式再拆成 `effects.js`、`projectiles-render.js`、`board-render.js`、`snake-render.js`。
  - 目標：降低單檔 200KB 以上的視覺邏輯維護成本。
  - 驗收：effect comparison mode、一般戰鬥畫面、技能特效均正常。

- 平衡與 AI 報表整理
  - 範圍：整理 `reports/` 的 csv/json 輸出，建立簡短摘要格式。
  - 目標：讓 AI 與平衡調整可以基於可讀報表，不只看 raw output。
  - 驗收：每次模擬後有摘要可供後續調整使用。
  - 現況：`simulate-balance` 已能輸出 `*.md` 摘要；策略最佳化的新版 `comparison.md` 仍需用完成跑次驗證。

## Routine Checks

每次改動資料、技能、AI、渲染或平衡時，至少執行：

```bash
npm.cmd run build
npm.cmd run test:quick
```

涉及 AI 或平衡時，追加：

```bash
npm.cmd test
npm.cmd run simulate
```

涉及前端互動或拆模組時，追加瀏覽器 smoke test：

```bash
npm.cmd run test:smoke
```

目前 `test:smoke` 尚未建立，先以手動 in-app browser smoke test 代替，但仍保留為 P0 任務。
