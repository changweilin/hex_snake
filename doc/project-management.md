# Hex Snake Project Management

更新日期：2026-05-20（Asia/Taipei）

## 單一控管原則

這份文件是 Hex Snake 專案目前唯一的進度控管入口。後續要查「現在做到哪裡、下一步做什麼、發布前還缺什麼」，先看這份文件。

其他進度文件保留為細節、背景或專項 checklist，不再各自作為最高層級狀態來源：

- `app-deployment-plan.md`：App / PWA / Capacitor 導入歷程與部署背景。
- `pre-app-optimization-plan.md`：App 化前優化歷程與已完成項目。
- `doc/follow-up-execution-list.md`：舊版待辦池與詳細技術 backlog。
- `doc/local-multiplayer-progress-plan.md`：LAN / Wi-Fi 多人連線專項計畫。
- `store/release-checklist.md`：Google Play / App Store 上架專項 checklist。
- `doc/strategy-optimization-sop.md`：AI 策略訓練與驗證 SOP，不作為一般專案進度表。
- `reports/`：模擬、訓練、驗證產物，只作為證據與歷史輸出，不作為人工進度表。

更新規則：

1. 狀態、優先順序、下一步先更新本文件。
2. 若某項目有專項細節，再同步更新對應文件。
3. `reports/` 只放自動產物與結果證據，人工判斷寫回本文件。
4. 已完成但仍需要保留脈絡的內容，放在「已完成封存」或原文件細節，不再混入待辦。

## 目前總覽

| 領域 | 狀態 | 下一步 | 驗收 / 證據 |
| --- | --- | --- | --- |
| Android 上架主線 | 進行中 | 實機驗證 → 正式簽章 → Play internal testing | `store/release-checklist.md` |
| iOS 上架主線 | blocked | 取得 macOS / Xcode / Apple signing 環境 | 尚未驗證 |
| LAN / Wi-Fi 多人 | MVP 已完成 | Phase 2 protocol hardening | `doc/local-multiplayer-progress-plan.md` |
| AI / 規則一致性 | 待啟動 | 先做 browser / simulator 對齊，再判斷策略套用或效能優化 | `doc/strategy-optimization-sop.md`、`reports/` |
| 架構整理 | 待啟動 | 先做 facade / ES modules 邊界整理，再抽共用規則核心 | `npm run audit:globals`、`doc/legacy-global-dependencies.md` |
| 產品延伸 | 暫緩 | 等上架與核心穩定後再推 replay 分享、每日挑戰、觀戰聯賽 | 本文件 P3 |

## 主控看板

### P0 - 立即處理：上架阻塞

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| Android 實機驗證 | 未完成 | 安裝 debug APK，測返回鍵、背景暫停 / 恢復、震動、音效 unlock、長時間效能 | 實機測試紀錄寫回本文件與 `store/release-checklist.md` |
| Android 正式簽章 | 未完成 | 建立 upload keystore，填入 `android/signing.properties` 或 CI secrets | `npm run android:bundle:signed` 產出 signed release AAB |
| Google Play internal testing | 未完成 | 建立 Play Console internal testing，補資料安全、內容分級、截圖與商店欄位 | internal testing 可發布 |
| iOS build / TestFlight | blocked | 取得 macOS / Xcode / Apple signing 後執行 build、provisioning、TestFlight | Xcode build 與 TestFlight build 通過 |

### P1 - 近期處理：多人、AI、核心風險

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| LAN protocol hardening | 未開始 | 加 sequence number、latency telemetry、reconnect、snapshot throttling，補 server room routing 測試 | Host / Guest reconnect 與 snapshot 節流可驗證 |
| AI / simulator 對齊檢查 | 未開始 | 執行 browser auto battle smoke 與 `simulate:ai-cross`，列出 browser / simulator 差異 | 實戰與 simulator 關鍵行為一致或差異有紀錄 |
| 策略套用判斷 | 等待 AI 對齊 | 檢查最新 `comparison.md` marginal delta 與 SOP apply gate | 符合 gate 才套用 `best-strategies-for-apply.json` |
| AI 效能優化 | 等待 profiling | 只針對有量測證據的熱點評估 bitset / allocation cleanup | 有前後 timing 對比，行為差異可解釋 |

### P2 - 後續整理：架構與維護性

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| 核心 facade / ES modules | 未開始 | 先從 `characters.js`、`audio.js`、`replay.js` 與 `game.js` facade wrapper 開始，不改行為 | build、quick、smoke、audit 通過 |
| Browser / simulator 共用規則核心 | 未開始 | 等 AI 對齊差異明確後，先抽純函式與常數，不碰 DOM/UI state | 同 seed 關鍵差異可解釋 |
| Render / CSS 拆分 | 未開始 | 先列 board/snake/effects 與 layout/settings/portrait/replay/HUD 搬移清單 | 桌機與手機 smoke screenshot 正常 |

### P3 - 暫緩：產品延伸

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| Replay 分享與對局摘要 | 未開始 | 定 replay schema 版本、壓縮方式與大小限制 | 匯出/匯入後可重播並顯示摘要 |
| 每日挑戰 / 觀戰聯賽 | 未開始 | 先定 daily seed 規則，再評估 AI vs AI 觀戰頁 | 每日 seed 可重現，多場觀戰不中斷 UI |

## 已完成封存

這些項目已不再放在 active 看板，發布前只需跑固定檢查防止回歸：

| 項目 | 完成證據 | 後續維護方式 |
| --- | --- | --- |
| Build 正規化 | `dist/index.html` 載入 `assets/app.bundle.js`，不再依賴 source module entry | `app:check` |
| PWA / 離線基礎 | manifest、icons、service worker、offline fallback 已完成 | `test:offline`、`app:check` |
| 素材壓縮與部署瘦身 | `dist` 約 26.71 MB，WebP / M4A 轉檔與 forbidden asset 檢查已納入 build | `check:assets`、`check:size` |
| 文字與編碼檢查 | `text:check` 可掃描 README、HTML、JS、JSON、文件與工具 | `text:check` |
| Browser / mobile smoke | `tools/smoke-test.js`、`mobile-smoke-test.js` 已覆蓋主要 UI 與 replay | `test:smoke`、`test:mobile` |
| Release gate | `release:check` 串接 build、text、data、assets、size、quick、mobile、smoke、offline、app readiness | `release:check` |
| App shell 基礎封裝 | Capacitor 8、Android / iOS 專案、mobile platform adapter、APK / AAB build scripts 已建立 | `app:check`、Android build scripts |
| 商店草稿與本機檢查 | listing、privacy policy、release checklist 與 `store:check` 已建立 | `store:check` |

## 衝突整理

舊文件中有幾處狀態已被新進度覆蓋，這裡統一判定：

- `doc/follow-up-execution-list.md` 舊版曾將「PWA 與離線遊玩」列為未開始，但 `pre-app-optimization-plan.md`、`app-deployment-plan.md` 與現有腳本已顯示 PWA / service worker / offline fallback 已完成並納入 `app:check`。主控狀態以「已完成」為準。
- `pre-app-optimization-plan.md` 的 `dist` 舊基準曾是 153.77 MB；目前主控採最新 App 計畫與 release check 結果，約 26.71 MB。
- `doc/follow-up-execution-list.md` 的 P0 safety nets 已大多完成，剩餘只作為歷史與細節來源；active 待辦以本文件 P0/P1/P2/P3 為準。
- `reports/` 中的策略輸出只代表當次模擬結果。是否套用策略，以 `doc/strategy-optimization-sop.md` 的 apply gate 與本文件主控判斷為準。

## 順序檢查

目前安排合理，原因如下：

1. Android 實機驗證排在簽章與 Play 後台前，因為返回鍵、背景恢復、震動、音效 unlock 或長時間效能若有問題，會直接影響上架品質。
2. 正式簽章排在 internal testing 前，因為 signed release AAB 是 Play 測試版可上傳的必要產物。
3. iOS 目前被環境阻塞，因此不阻擋 Android 主線；取得 macOS / Xcode 後可與 Android Play 後台並行。
4. LAN protocol hardening 排在上架阻塞後，因為它是產品能力增強，不應卡住目前已接近可測機的 App 發布流程。
5. AI / simulator 對齊排在策略套用與共用規則核心之前，因為尚未確認差異前，直接套策略或抽共用核心都容易把錯誤固定下來。
6. Facade / ES modules 排在共用規則核心之前，因為先清楚模組邊界，再抽共享純函式，回歸風險較低。
7. Replay 分享、每日挑戰、觀戰聯賽屬產品延伸，等上架、多人協議與核心穩定後再做，避免擴大同時變更面。

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
```

涉及 UI、replay、瀏覽器互動、ES modules 或手機操作：

```bash
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
```

需要完整策略訓練或套用時，依 `doc/strategy-optimization-sop.md` 執行。

## 下一輪建議順序

1. Android 實機安裝 debug APK，確認返回鍵、背景恢復、震動、音效 unlock 與長時間遊玩。
2. 建立正式 upload keystore，產出 `android:bundle:signed`。
3. 建立 Google Play internal testing，補資料安全、內容分級、截圖與商店欄位。
4. 找 macOS / Xcode 環境執行 iOS build 與 TestFlight；若環境已備妥，可與第 2-3 步並行。
5. 補 LAN 多人 Phase 2：sequence number、latency、reconnect、snapshot throttling、server room routing 測試。
6. 執行高階 AI v1 browser / simulator 對齊檢查，再決定是否套用最新策略輸出或做 AI 效能優化。
7. 推進 `game.js` facade / ES modules，再抽 browser / simulator 共用規則核心。
8. 最後再做 replay 分享、每日挑戰與觀戰聯賽。
