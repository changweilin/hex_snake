# Follow-up Execution List

更新日期：2026-05-22（Asia/Taipei）

> 進度主控入口：[`project-management.md`](project-management.md)。本文件只保留細節 backlog 與歷史脈絡；目前狀態、優先順序與下一步以主控文件為準。

## 清理原則

- 已完成項目不再留在 active detail；只在「已封存摘要」保留一行。
- Active detail 只放仍可能被執行的未完成、等待驗證、blocked 或條件式工作。
- 若主控文件與本文件衝突，以 `project-management.md` 為準。

## 已封存摘要

- Safety nets：browser/mobile smoke、module loader smoke、text/data/assets/size/app checks 已建立。
- PWA / 離線遊玩：manifest、service worker、offline fallback 與更新提示已完成。
- Replay 基礎回歸：replay modal、列表、播放、暫停、倒放、速度切換、seek、刪除、ESC / backdrop 關閉已納入 smoke。
- LAN hardening：room lifecycle、sequence numbers、relay ack、latency、snapshot throttling、reconnect / rejoin 與 snapshot 穩定性自動化已完成。
- AI / 規則 preflight：2026-05-22 已重跑小樣本 `simulate:ai-cross`；現行策略保留，不套用既有不合格輸出。
- ES module / facade 基礎：state boundary、service facade、module-shadow、source module、dist fallback 與 export map gate 已建立。
- Android / store 基礎：debug 實機驗證、release signing、signed AAB path、listing / privacy policy / checklist 已建立。

## Active Detail - AI

- AI 效能後續優化
  - 範圍：只處理第一輪快取後仍有 profiling 證據的熱點。
  - 目標：避免為了極限效能過早犧牲可讀性；先量測，再決定是否進入資料結構重構。
  - 待辦：評估 lookahead bitset / allocation cleanup，將 `{ q, r }`、`Set<string>`、臨時 snake array 逐步改成 cell index、bitset / typed array、可重用 buffer 或 object pool。
  - 待辦：評估技能目標候選再縮小，減少 `bestBodyClusterTarget`、技能 EV target candidates、damage target 排序的候選格數。
  - 驗收：保留行為測試與 `simulate:ai-cross` smoke；提交前後 timing 對比，若同 seed 結果改變，需要能說明是等價排序差異還是 bug。

- AI strategy retrain gate
  - 範圍：只有在要推新策略時才重啟訓練或套用。
  - 目標：先修 dragon 負 delta 與 gu_king qualified 不足，不直接套用 2026-05-10 overnight 或 2026-05-16 progress-test。
  - 驗收：正式 `comparison.md` 與 `evaluate:strategy-gate` 都不能出現不可接受負 delta。

## Active Detail - Codebase And Tests

- 收斂 `game.js` 與 facade API
  - 範圍：把剩餘核心邏輯再分成較小檔案，例如 `combat.js`、`movement.js`、`input.js`、`loop.js`；補齊明確 facade。
  - 目標：讓 `game.js` 只負責 bootstrap 與高階流程協調，並為真正 ES module `import/export` 做準備。
  - 驗收：拆分後 build 與 smoke test 通過；遊戲開始、移動、攻擊、結束流程正常。
  - 下一步：先抽不碰行為的 facade wrapper，等 smoke test 存在後再拆核心流程。

- Browser / simulator 共用遊戲規則核心
  - 範圍：盤點並逐步抽出 `src/game.js` 與 `tools/sim-core.js` 重複的規則，例如 wrapped movement、attack stats、damage、projectile/hazard resolution、食物收集與角色大招效果。
  - 目標：讓瀏覽器實戰與 AI 模擬使用同一套規則來源，降低策略最佳化結果與實際遊戲不一致的風險。
  - 驗收：共用核心有單元測試；`test:quick`、`simulate:ai-cross` smoke、browser smoke 均通過；同 seed 的關鍵對局差異可解釋。
  - 下一步：先抽純函式與常數，不先搬 DOM/UI/visual state。

## Active Detail - Architecture

- 真正 ES modules
  - 範圍：逐步移除 `src/main.js` 的 legacy concatenated module loader，改成 `import/export`。
  - 目標：讓模組邊界由語言層級保護，而不是只靠載入順序。
  - 驗收：source module、module-shadow 與 dist fallback gate 全通過；production module strategy 有 source map / release gate。
  - 下一步：延續 Phase D service module migration，挑下一個低風險 alias / export slice。

- 拆分 `render.js`
  - 範圍：把大型特效函式再拆成 `effects.js`、`projectiles-render.js`、`board-render.js`、`snake-render.js`。
  - 目標：降低單檔 200KB 以上的視覺邏輯維護成本。
  - 驗收：effect comparison mode、一般戰鬥畫面、技能特效均正常。
  - 下一步：先建立只轉移函式、不改行為的 board/snake/effects 分層清單。

- CSS 與 UI 狀態整理
  - 範圍：將大型 `styles.css` 依功能拆成 layout、settings、portrait/replay、battle HUD、modal/effects 等區塊；同步整理 UI 狀態命名。
  - 目標：降低 UI 調整時的選擇器衝突與 mobile layout regression。
  - 驗收：桌機與手機尺寸 smoke screenshot 正常；settings、portrait lightbox、replay、auto battle 控制不重疊。
  - 下一步：再做純搬移式拆分時，保持 selectors 與樣式值不變，逐段搬 layout/settings/portrait/replay/HUD。

## Active Detail - Product Extensions

- Replay 分享與對局摘要
  - 範圍：支援 replay 匯出/匯入、可分享 replay payload 或檔案、對局摘要與關鍵事件列表。
  - 下一步：先定 replay schema 版本與壓縮/大小限制。

- 每日挑戰與觀戰聯賽
  - 範圍：加入 daily seed challenge、固定角色/規則挑戰、AI vs AI 觀戰聯賽或錦標賽頁。
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

涉及瀏覽器互動、ES modules、replay 或 UI 狀態時，追加：

```bash
npm.cmd run test:smoke
npm.cmd run audit:globals
```

建議推進順序以 `project-management.md` 為準。
