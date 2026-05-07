# Follow-up Execution List

最後整理：2026-05-07（Asia/Taipei）

這份清單只保留目前值得排入後續開發的未完成事項。已完成的拆檔、文件可讀性巡檢、高階 AI v1 落地與手動 smoke 記錄已移出待辦；平衡判斷請改以最新 `reports/` 輸出或重新執行模擬結果為準。

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
  - 現況：`reports/strategy-quick-20260507-183526/` 只有 `config.json`、log 與 `ga/`，尚未產生 `manifest.json` 或 `comparison.md`。

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
  - 現況：README 常用指令已有 `npm run optimize:strategy`，但相關文件區塊尚未列出 SOP。

- 高階 AI v1 後續觀察與調校
  - 範圍：針對 runtime JSON 策略、移動 lookahead、技能 EV 進行實戰與模擬對齊檢查。
  - 目標：確認瀏覽器實際對戰與 `tools/sim-core.js` 模擬核心行為一致，並避免特定角色因 lookahead 或 EV 門檻出現明顯退步。
  - 驗收：完成一輪手動 auto battle smoke、至少一輪 `simulate:ai-cross` 小樣本比較，並把需要調整的角色或技能列入策略最佳化 SOP。
  - 後續：若 EV 門檻、target 權重或 lookahead 終局懲罰需要頻繁調整，再評估 v2 是否新增策略欄位；目前仍維持 `data/high-ai-strategies.json` schema 不變。
  - 效能觀察：`simulate:ai-cross --runs 5 --jobs 1` 若明顯超過目前約 9 分鐘級距，優先檢查 `bestBodyClusterTarget`、lookahead 距離快取與長局時間。

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
