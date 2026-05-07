# Follow-up Execution List

更新日期：2026-05-08（Asia/Taipei）

這份清單只列未完成事項。已完成的工作不再保留為待辦；平衡與 AI 判斷請改以最新 `reports/` 輸出或重新執行模擬結果為準。

## P0 - Safety Nets

- 補 browser smoke test script
  - 範圍：新增瀏覽器 smoke test，固定檢查首頁載入、開始遊戲、開 settings、開 replay modal。
  - 目標：後續拆 `game.js`、轉 ES modules、調整 UI 或 replay 時，有快速保護網。
  - 驗收：可用 `npm.cmd run test:smoke` 或類似指令執行；失敗時輸出 console error 與失敗步驟。
  - 狀態：`package.json` 尚未定義 `test:smoke`。

- 收尾策略最佳化與 AI 報表流程
  - 範圍：完成 target-vs-baseline quick profile 產物、補 README/SOP 導覽、整理可讀報表。
  - 目標：讓策略訓練、驗證、套用與報表判讀能從專案根目錄一路追到 `doc/strategy-optimization-sop.md` 與 `reports/`。
  - 驗收：輸出目錄包含 `baseline-cross.*`、`best-cross.*`、`comparison.md`、`manifest.json`；README 文件導覽列出策略最佳化 SOP；`comparison.md` 能清楚列出每個角色的 marginal delta。
  - 狀態：`reports/strategy-quick-20260507-183526/` 尚未產生 `manifest.json` 或 `comparison.md`。

## P1 - AI

- 高階 AI v1 行為驗證與調校
  - 範圍：針對 runtime JSON 策略、移動 lookahead、技能 EV、抵達時間評估與食物資源價值做瀏覽器實戰與模擬對齊檢查。
  - 目標：確認瀏覽器實際對戰與 `tools/sim-core.js` 模擬核心行為一致，並避免特定角色因 lookahead / EV / 食物目標邏輯出現明顯退步。
  - 驗收：完成一輪手動 auto battle smoke、至少一輪較完整 `simulate:ai-cross` 比較，並把需要調整的角色或技能列入策略最佳化 SOP。
  - 後續判斷：若 EV 門檻、target 權重或 lookahead 終局懲罰需要頻繁調整，再評估 v2 是否新增策略欄位；目前仍維持 `data/high-ai-strategies.json` schema 不變。

- AI 效能後續優化
  - 範圍：只處理第一輪快取後仍有 profiling 證據的熱點。
  - 目標：避免為了極限效能過早犧牲可讀性；先量測，再決定是否進入資料結構重構。
  - 待辦：評估 lookahead bitset / allocation cleanup，將 `{ q, r }`、`Set<string>`、臨時 snake array 逐步改成 cell index、bitset / typed array、可重用 buffer 或 object pool。
  - 待辦：評估技能目標候選再縮小，減少 `bestBodyClusterTarget`、技能 EV target candidates、damage target 排序的候選格數。
  - 驗收：保留行為測試與 `simulate:ai-cross` smoke；提交前後 timing 對比，若同 seed 結果改變，需要能說明是等價排序差異還是 bug。

## P1 - Codebase And Tests

- 收斂 `game.js` 與 facade API
  - 範圍：把剩餘核心邏輯再分成較小檔案，例如 `combat.js`、`movement.js`、`input.js`、`loop.js`；補齊 `HexSnakeAI`、`HexSnakeRenderer` 等明確 facade。
  - 目標：讓 `game.js` 只負責 bootstrap 與高階流程協調，並為真正 ES module `import/export` 做準備。
  - 驗收：拆分後 build 與 smoke test 通過；遊戲開始、移動、攻擊、結束流程正常；外部呼叫點不再直接操作 replay/audio/AI/render 內部狀態。

- 補 replay 回歸測試
  - 範圍：建立可重複的 replay 記錄、播放、暫停、倒放、seek 測試。
  - 目標：避免 replay facade 或後續狀態整理造成回放壞掉。
  - 驗收：replay modal 和播放控制可以自動化驗證。

## P2 - Architecture

- 轉真正 ES modules
  - 範圍：逐步移除 `src/main.js` 的 `eval` loader，改成 `import/export`。
  - 目標：讓模組邊界由語言層級保護，而不是只靠載入順序。
  - 驗收：`<script type="module" src="src/main.js">` 直接 import 各模組，無 global scope 隱性依賴。

- 拆分 `render.js`
  - 範圍：把大型特效函式再拆成 `effects.js`、`projectiles-render.js`、`board-render.js`、`snake-render.js`。
  - 目標：降低單檔 200KB 以上的視覺邏輯維護成本。
  - 驗收：effect comparison mode、一般戰鬥畫面、技能特效均正常。

## Routine Checks

每次改動資料、技能、AI、渲染或平衡時，至少執行：

```bash
npm.cmd run build
npm.cmd run test:quick
```

涉及 AI 或平衡時，追加：

```bash
npm.cmd run simulate:ai-cross -- --runs 5 --jobs 1 --seed <purpose>
```

需要完整回歸時再執行：

```bash
npm.cmd test
npm.cmd run simulate
```

涉及瀏覽器互動、ES modules、replay 或 UI 狀態時，追加 smoke test。目前 `test:smoke` 尚未建立，先以手動 in-app browser smoke test 代替。
