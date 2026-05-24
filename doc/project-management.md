# Hex Snake Project Management

更新日期：2026-05-22（Asia/Taipei）

## 單一控管原則

這份文件是 Hex Snake 專案目前唯一的進度控管入口。後續要查「現在做到哪裡、下一步做什麼、發布前還缺什麼」，先看這份文件。

其他文件保留為細節、背景或專項 checklist：

- `app-deployment-plan.md`：App / PWA / Capacitor 導入歷程與部署背景。
- `pre-app-optimization-plan.md`：App 化前優化歷程與已完成項目。
- `doc/follow-up-execution-list.md`：舊版待辦池與詳細技術 backlog。
- `doc/local-multiplayer-progress-plan.md`：LAN / Wi-Fi 多人連線專項計畫。
- `store/release-checklist.md`：Google Play / App Store 上架專項 checklist。
- `doc/strategy-optimization-sop.md`：AI 策略訓練與驗證 SOP。
- `doc/es-module-*.md`：ES module split 的設計、loader、export surface 與 production gate。
- `reports/`：模擬、訓練、驗證產物，只作為證據與歷史輸出，不作為人工進度表。

更新規則：

1. Active 狀態、優先順序、下一步先更新本文件。
2. 已完成項目不再留在 active 看板；只保留摘要或移回專項文件。
3. `reports/` 只放自動產物與結果證據，人工判斷寫回本文件。
4. 大段歷史不要累加在主控頁；必要時引用專項文件、報告路徑或 git history。

## 目前總覽

| 領域 | 狀態 | 下一步 | 驗收 / 證據 |
| --- | --- | --- | --- |
| Android 上架主線 | 進行中 | Play internal testing | `store/release-checklist.md` |
| iOS 上架主線 | blocked | 取得 macOS / Xcode / Apple signing 環境 | 尚未驗證 |
| LAN / Wi-Fi 多人 | 自動化 hardening 完成 | 上架前真機雙機長測；WebRTC 延後 | `doc/local-multiplayer-progress-plan.md`、`test:network` |
| AI / 規則一致性 | preflight 已刷新，現行策略保留 | 新策略必須先重訓並通過 target-vs-field gate | `doc/strategy-optimization-sop.md`、`reports/ai-cross-20260522-022605-lan-ai-rules-stability-20260522.md` |
| 架構整理 | Phase D service module migration 進行中 | 下一個低風險 ESM alias / export slice | `audit:esm-map`、`test:module-loader`、`doc/es-module-export-map.md` |
| 產品延伸 | 暫緩 | 等上架與核心穩定後再推 replay 分享、每日挑戰、觀戰聯賽 | 本文件 P3 |

## Active 看板

### P0 - 上架阻塞

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| Google Play internal testing | 未完成 | 建立 Play Console internal testing，補資料安全、內容分級、截圖與商店欄位，並上傳 signed release AAB | internal testing 可發布 |
| iOS build / TestFlight | blocked | 取得 macOS / Xcode / Apple signing 後執行 build、provisioning、TestFlight | Xcode build 與 TestFlight build 通過 |

### P1 - 上架前風險

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| LAN 真機雙機長測 | 等待裝置驗收 | 用兩台真機跑長時間 reconnect / snapshot 穩定性；此項是人工驗收，不是 AI-blocking 實作 | 長時間對局可重連、guest snapshot 持續更新、無明顯狀態跳號 |
| AI strategy retrain gate | 條件式待辦 | 只有在要推新策略時才重訓；優先修 dragon 負 delta 與 gu_king qualified 不足 | `comparison.md` 與 `evaluate:strategy-gate` 無不可接受負 delta |
| AI 效能優化 | 等待 profiling | 只針對有量測證據的熱點評估 bitset / allocation cleanup | 有前後 timing 對比，行為差異可解釋 |

### P2 - 架構與維護性

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| 核心 facade / ES modules | Phase D 進行中 | 延續 service module migration，挑下一個低風險 alias / export slice；production 維持 `bundled-legacy-fallback` | build、quick、smoke、audit 通過 |
| Browser / simulator 共用規則核心 | 未開始 | 等 AI 對齊差異明確後，先抽純函式與常數，不碰 DOM/UI state | 同 seed 關鍵差異可解釋 |
| Render / CSS 拆分 | 未開始 | 先列 board/snake/effects 與 layout/settings/portrait/replay/HUD 搬移清單 | 桌機與手機 smoke screenshot 正常 |

### P3 - 產品延伸

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| Replay 分享與對局摘要 | 未開始 | 定 replay schema 版本、壓縮方式與大小限制 | 匯出/匯入後可重播並顯示摘要 |
| 每日挑戰 / 觀戰聯賽 | 未開始 | 先定 daily seed 規則，再評估 AI vs AI 觀戰頁 | 每日 seed 可重現，多場觀戰不中斷 UI |

## 已完成摘要

已完成項目不再逐列留在 active 看板。保留以下摘要方便回查；詳細切片請看專項文件與 git history。

| 類別 | 摘要 | 維護檢查 |
| --- | --- | --- |
| Web / PWA / App shell | build 正規化、PWA 離線基礎、manifest/icons/service worker、素材壓縮、文字編碼、app readiness 已建立 | `build`、`test:offline`、`check:assets`、`check:size`、`text:check`、`app:check` |
| Browser / mobile smoke | desktop/mobile UI、settings、portrait lightbox、rules modal、replay modal、module loader modes 已有自動化覆蓋 | `test:smoke`、`test:mobile`、`test:module-loader` |
| LAN protocol hardening | room lifecycle、sequence number、relay ack、latency、snapshot throttling、reconnect / rejoin 與 snapshot 穩定性自動化已完成 | `test:network` |
| AI / 規則安全網 | 2026-05-22 小樣本 `simulate:ai-cross` 已刷新；既有策略 gate 判定仍是不套用新策略 | `test:quick`、`simulate:ai-cross`、`evaluate:strategy-gate` |
| State boundary / facade | `game.js` 對 UI/state 的大型 direct read/write 已收斂到 state / UI / service facade，`audit:state-boundary` 維持 0/0 | `audit:state-boundary` |
| ES module loader baseline | module-shadow、source module、dist fallback、production module strategy 與 export map gate 已建立 | `audit:esm-map`、`test:module-loader` |
| Android readiness | debug APK 實機驗證、release signing、signed AAB build path、store draft/checklist 已建立 | `android:bundle:signed`、`store:check` |

## 衝突整理

- 舊文件中曾標為未開始的 PWA / 離線遊玩、smoke test、replay 基礎回歸與 LAN hardening，現在都以本文件的完成摘要為準。
- `reports/` 中的策略輸出只代表當次模擬結果。是否套用策略，以 `doc/strategy-optimization-sop.md` 的 apply gate 與本文件主控判斷為準。
- `pre-app-optimization-plan.md` 的舊 dist 大小基準已過期；目前以 build / release check 的最新輸出為準。

## 順序檢查

1. 先推 Google Play internal testing，因為它會暴露商店後台、資料安全、內容分級與上傳格式等真正上架阻塞。
2. iOS 目前被環境阻塞，不阻擋 Android 主線；取得 macOS / Xcode 後可並行。
3. LAN 自動化 hardening 已完成，剩餘是真機長測，排在上架前人工驗收。
4. AI / simulator preflight 已刷新；新策略仍必須重訓並通過正式 gate。
5. Facade / ES modules 排在共用規則核心之前，因為先清楚模組邊界，再抽共享純函式，回歸風險較低。
6. Replay 分享、每日挑戰、觀戰聯賽屬產品延伸，等上架、多人協議與核心穩定後再做。

## 固定檢查

一般文件或資料變更：

```bash
npm.cmd run text:check
npm.cmd run data:check
```

一般程式變更：

```bash
npm.cmd run build
npm.cmd run test:quick
npm.cmd run test:network
npm.cmd run audit:state-boundary
```

涉及 UI、replay、瀏覽器互動、ES modules 或手機操作：

```bash
npm.cmd run audit:esm-map
npm.cmd run test:module-loader
npm.cmd run test:smoke
npm.cmd run test:mobile
```

涉及 PWA / App shell / 發布：

```bash
npm.cmd run app:check
npm.cmd run release:check
```

涉及 Android build：

```bash
npm.cmd run android:build:debug
npm.cmd run android:bundle:release
```

正式 Google Play 上傳前：

```bash
npm.cmd run android:bundle:signed
npm.cmd run store:check
```

涉及 AI 或平衡：

```bash
npm.cmd run simulate:ai-cross -- --runs 5 --jobs 1 --seed <purpose>
npm.cmd run evaluate:strategy-gate -- --character <id> --candidates <candidate-json> --runs 10 --top 3
```

需要完整策略訓練或套用時，依 `doc/strategy-optimization-sop.md` 執行。

## 下一輪建議順序

1. 建立 Google Play internal testing，補資料安全、內容分級、截圖與商店欄位，並上傳 signed release AAB。
2. 找 macOS / Xcode 環境執行 iOS build 與 TestFlight；若環境已備妥，可與第 1 步並行。
3. 做 LAN 真機雙機長時間 reconnect / snapshot 驗證。
4. 執行 ES module split 下一批低風險 alias / export slice，production 繼續 `bundled-legacy-fallback`。
5. 若要繼續 AI 訓練，先以 dragon / gu_king 為目標重跑完整 target-vs-field gate，不直接套用既有輸出。
6. 最後再做 replay 分享、每日挑戰與觀戰聯賽。
