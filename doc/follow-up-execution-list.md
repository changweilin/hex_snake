# Follow-up Execution List

更新日期：2026-05-20（Asia/Taipei）

> 進度主控入口：[`project-management.md`](project-management.md)。本文件保留詳細 backlog 與歷史脈絡；目前狀態、優先順序與下一步以主控文件為準。

這份清單現在作為歷史 backlog 與細節索引。已完成項目已從 active 控管移出；目前優先順序、下一步與跨文件狀態請看 `project-management.md`。

管理欄位慣例：

- 狀態：未開始 / 進行中 / 等待驗證 / blocked。
- 下一步：下一個可以直接執行的具體動作。
- 驗收：能判斷該項目完成的命令、產物或手動檢查。

## 已封存 - Safety Nets

這些項目已完成，不再列為待辦：

- Browser / mobile smoke test：`tools/smoke-test.js`、`mobile-smoke-test.js` 已覆蓋主要 UI、settings、portrait lightbox、rules modal、replay modal 與手機尺寸。
- 瀏覽器測試依賴與 lockfile：已補 `playwright`、`@ffmpeg-installer/ffmpeg` 與 `package-lock.json`。
- 資產與部署瘦身：build 已排除來源/備份/debug/full-size 非部署資產，並建立 size budget 與 forbidden deployment assets 檢查；目前最新主控採 `dist` 約 26.71 MB。
- 策略最佳化報表流程：target-vs-baseline run 已封存，dashboard 已重新產生；是否套用策略改由 `doc/strategy-optimization-sop.md` 與 `project-management.md` 判斷。
- PWA / 離線遊玩：manifest、service worker、offline fallback 與更新提示已完成，舊 P3 項目不再視為未開始。

## Active Detail - AI

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

## Active Detail - Codebase And Tests

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
  - 狀態：基礎回歸測試已整合到 `tools/smoke-test.js`；固定 replay fixture 會驗證 modal 列表、加入/取消最愛、播放、暫停、倒放、速度切換、seek、離開播放、刪除、空清單、ESC 關閉與背景關閉，桌機與手機 smoke 已通過。
  - 下一步：後續若要擴充 Product Extensions，再補匯出/匯入 replay payload 與真實對局產生 replay 的端到端測試。

## P2 - Architecture

- 轉真正 ES modules
  - 範圍：逐步移除 `src/main.js` 的 legacy concatenated module loader，改成 `import/export`。
  - 目標：讓模組邊界由語言層級保護，而不是只靠載入順序。
  - 驗收：`<script type="module" src="src/main.js">` 直接 import 各模組，無 global scope 隱性依賴。
  - 狀態：已建立 `npm run audit:globals` 與 `doc/legacy-global-dependencies.md`，可盤點目前 legacy concatenated loader 載入順序下的跨檔 global 讀取；直接 `eval` 已先移除。
  - 下一步：先從 `characters.js`、`audio.js`、`replay.js` 這類邊界較清楚的檔案開始，把盤點結果轉成 import/export 切分清單。

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
  - 狀態：已先加 CSS 區段註記；`tools/smoke-test.js` 已覆蓋 settings、portrait lightbox、rules modal、replay modal 的桌機/手機開關流程。
  - 下一步：再做純搬移式拆分時，保持 selectors 與樣式值不變，逐段搬 layout/settings/portrait/replay/HUD。

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

涉及 ES modules 或 legacy global 盤點時，追加：

```bash
npm.cmd run audit:globals
```

建議推進順序已移到 `project-management.md`。本文件只保留各工作項目的細節說明。
