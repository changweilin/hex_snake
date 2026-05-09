# Follow-up Execution List

更新日期：2026-05-09（Asia/Taipei）

這份清單以未完成事項為主。剛完成的 P0 可以短期保留狀態，下一輪整理時再移除；平衡與 AI 判斷請改以最新 `reports/` 輸出或重新執行模擬結果為準。

管理欄位慣例：

- 狀態：未開始 / 進行中 / 等待驗證 / blocked。
- 下一步：下一個可以直接執行的具體動作。
- 驗收：能判斷該項目完成的命令、產物或手動檢查。

## P0 - Safety Nets

- 補 browser smoke test script
  - 範圍：新增瀏覽器 smoke test，固定檢查首頁載入、開始遊戲、開 settings、開 replay modal。
  - 目標：後續拆 `game.js`、轉 ES modules、調整 UI 或 replay 時，有快速保護網。
  - 驗收：可用 `npm.cmd run test:smoke` 或類似指令執行；失敗時輸出 console error 與失敗步驟。
  - 狀態：完成；新增 `tools/smoke-test.js` 與 `npm.cmd run test:smoke`，desktop/mobile smoke 已通過。
  - 下一步：CI 首次跑完後可移出待辦；若後續新增 replay 測試，再擴充此 script。

- 補齊瀏覽器測試依賴與 lockfile
  - 範圍：補 `devDependencies` 與 lockfile，至少涵蓋 smoke test 會用到的瀏覽器自動化依賴；若仍保留 `tools/record-mobile-auto-battle.js`，另補 `@ffmpeg-installer/ffmpeg` 或把錄影工具標記為 optional。
  - 目標：讓乾淨 checkout 後能依 README 指令重建測試環境，避免本機全域套件或舊環境掩蓋缺依賴問題。
  - 驗收：`npm install` 後可執行 `npm.cmd run test:quick`、`npm.cmd run build`，以及新增後的 `npm.cmd run test:smoke`。
  - 狀態：完成；已補 `playwright`、`@ffmpeg-installer/ffmpeg` 與 `package-lock.json`。
  - 下一步：CI 首次跑完後確認 `npm ci` 與 `npx playwright install --with-deps chromium` 時間可接受。

- 資產與部署瘦身
  - 範圍：調整 `build.js`，只複製 runtime 需要的 assets/data/src；排除 `_source_chroma`、backup、q_versions、debug 圖與其他非部署資產；評估大型 PNG 轉 WebP/AVIF。
  - 目標：降低 GitHub Pages artifact、部署時間、下載量與儲存壓力。
  - 驗收：build 後 `dist/` 不包含來源/備份資產；產出 artifact size 報告；首頁、角色選擇、角色 lightbox、戰鬥與 replay 仍能載入需要的圖像。
  - 狀態：本機 build/smoke/data check 通過，等待 CI 驗證；`build.js` 已改為 runtime asset manifest 複製並排除 full-size portrait/runtime 未用資產，`dist/` 從約 734 MB 降到約 146 MB，且不再包含 `_source_chroma`、`q_versions`、backup、root full portrait 或 avatar full 目錄；已設定預設 `dist` size budget 為 200 MB，超標會讓 build 失敗。
  - 下一步：若還需要再瘦身，評估大型 PNG 轉 WebP/AVIF；若 artifact 成長是刻意的，需同步調整 `HEX_SNAKE_DIST_BUDGET_MB` 並記錄原因。

- 收尾策略最佳化與 AI 報表流程
  - 範圍：完成 target-vs-baseline quick profile 產物、補 README/SOP 導覽、整理可讀報表。
  - 目標：讓策略訓練、驗證、套用與報表判讀能從專案根目錄一路追到 `doc/strategy-optimization-sop.md` 與 `reports/`。
  - 驗收：輸出目錄包含 `baseline-cross.*`、`best-cross.*`、`comparison.md`、`manifest.json`；README 文件導覽列出策略最佳化 SOP；`comparison.md` 能清楚列出每個角色的 marginal delta。
  - 狀態：進行中；README 已補 `doc/strategy-optimization-sop.md` 與 dashboard 指令導覽；`reports/dashboard.html` 已重新產生；完整 overnight target-vs-baseline 訓練正在 `reports/strategy-full-overnight-cem-shortlist-bg-20260509-114019/` 執行，尚未產生最終 `manifest.json`。
  - 下一步：等待該 run 完成後檢查 `manifest.json`、`comparison.md`、`baseline-cross.*`、`best-cross.*`，再執行 `npm.cmd run reports:dashboard`。

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
  - 狀態：未開始。
  - 下一步：先抽不碰行為的 facade wrapper，等 smoke test 存在後再拆核心流程。

- browser / simulator 共用遊戲規則核心
  - 範圍：盤點並逐步抽出 `src/game.js` 與 `tools/sim-core.js` 重複的規則，例如 wrapped movement、attack stats、damage、projectile/hazard resolution、食物收集與角色大招效果。
  - 目標：讓瀏覽器實戰與 AI 模擬使用同一套規則來源，降低策略最佳化結果與實際遊戲不一致的風險。
  - 驗收：共用核心有單元測試；`npm.cmd run test:quick`、`simulate:ai-cross` smoke、browser smoke 均通過；同 seed 的關鍵對局差異可解釋。
  - 狀態：未開始；目前瀏覽器與 simulator 有多組規則函式分別實作。
  - 下一步：先抽純函式與常數，不先搬 DOM/UI/visual state。

- 補 replay 回歸測試
  - 範圍：建立可重複的 replay 記錄、播放、暫停、倒放、seek 測試。
  - 目標：避免 replay facade 或後續狀態整理造成回放壞掉。
  - 驗收：replay modal 和播放控制可以自動化驗證。
  - 狀態：未開始。
  - 下一步：等 browser smoke test 建好後，將 replay modal flow 擴成可重複測試。

## P2 - Architecture

- 轉真正 ES modules
  - 範圍：逐步移除 `src/main.js` 的 `eval` loader，改成 `import/export`。
  - 目標：讓模組邊界由語言層級保護，而不是只靠載入順序。
  - 驗收：`<script type="module" src="src/main.js">` 直接 import 各模組，無 global scope 隱性依賴。
  - 狀態：未開始。
  - 下一步：列出目前隱性 global 依賴，先從 `characters.js`、`audio.js`、`replay.js` 這類邊界較清楚的檔案開始。

- 拆分 `render.js`
  - 範圍：把大型特效函式再拆成 `effects.js`、`projectiles-render.js`、`board-render.js`、`snake-render.js`。
  - 目標：降低單檔 200KB 以上的視覺邏輯維護成本。
  - 驗收：effect comparison mode、一般戰鬥畫面、技能特效均正常。
  - 狀態：未開始。
  - 下一步：先建立只轉移函式、不改行為的 board/snake/effects 分層清單。

- CSS 與 UI 狀態整理
  - 範圍：將大型 `styles.css` 依功能拆成 layout、settings、portrait/replay、battle HUD、modal/effects 等區塊；同步整理 UI 狀態命名。
  - 目標：降低 UI 調整時的選擇器衝突與 mobile layout regression。
  - 驗收：桌機與手機尺寸 smoke screenshot 正常；settings、portrait lightbox、replay、auto battle 控制不重疊。
  - 狀態：未開始。
  - 下一步：先加瀏覽器 smoke，再做純搬移式拆分。

## P3 - Product Extensions

- Replay 分享與對局摘要
  - 範圍：支援 replay 匯出/匯入、可分享 replay payload 或檔案、對局摘要與關鍵事件列表。
  - 目標：讓 AI 調校、玩家回顧與 bug 回報更容易。
  - 驗收：可從一場對局產生 replay 檔或 payload，重新載入後能播放並顯示勝負、角色、時間、關鍵攻擊。
  - 狀態：未開始。
  - 下一步：先定 replay schema 版本與壓縮/大小限制。

- 每日挑戰與觀戰聯賽
  - 範圍：加入 daily seed challenge、固定角色/規則挑戰、AI vs AI 觀戰聯賽或錦標賽頁。
  - 目標：把目前的自動對戰與 AI 報表能力轉成可玩的長期內容。
  - 驗收：每日 seed 可重現；挑戰結果能顯示角色、分數、時間與勝負；觀戰模式能連續跑多場且不中斷 UI。
  - 狀態：未開始。
  - 下一步：先定 daily seed 規則與 localStorage 記錄格式。

- PWA 與離線遊玩
  - 範圍：加入 manifest、service worker、離線資產快取與版本更新提示。
  - 目標：讓 GitHub Pages 版本在手機上更像可安裝遊戲。
  - 驗收：Chrome/Edge 可安裝；離線重開可進入遊戲；資產版本更新後能刷新快取。
  - 狀態：未開始；需先完成資產瘦身，避免 service worker 快取過大。
  - 下一步：等部署資產清單穩定後再設計 cache strategy。

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

涉及瀏覽器互動、ES modules、replay 或 UI 狀態時，追加：

```bash
npm.cmd run test:smoke
```

建議推進順序：

1. 補齊瀏覽器 smoke test 與測試依賴。
2. 做資產與部署瘦身，建立 runtime asset manifest。
3. 收斂 facade，逐步改 ES modules。
4. 抽共用遊戲規則核心，降低 simulator/browser drift。
5. 補 replay 回歸測試，再推 Product Extensions。
