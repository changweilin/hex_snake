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
| Android 上架主線 | 進行中 | Play internal testing | `store/release-checklist.md` |
| iOS 上架主線 | blocked | 取得 macOS / Xcode / Apple signing 環境 | 尚未驗證 |
| LAN / Wi-Fi 多人 | Phase 2 自動化首輪完成 | 雙機長時間 reconnect / snapshot 驗證，之後規劃 WebRTC | `doc/local-multiplayer-progress-plan.md`、`test:network` |
| AI / 規則一致性 | gate 已檢查，不套用 | 保留現行策略；若再推策略，先針對 dragon 負 delta 與 gu_king qualified 不足做新訓練 | `doc/strategy-optimization-sop.md`、`reports/` |
| 架構整理 | ES module Phase 1 borders 完成 | low-risk module borders 首輪已完成；下一步做 Phase 2 helper extraction，先移出 `keyLabel`、`loadKeybinds`、`normalizeAutoBattleSpeed` 的 `ui.js -> game.js` late dependency | `npm run audit:globals`、`npm run audit:state-boundary`、`doc/state-boundary-audit.md`、`doc/es-module-split-map.md` |
| 產品延伸 | 暫緩 | 等上架與核心穩定後再推 replay 分享、每日挑戰、觀戰聯賽 | 本文件 P3 |

## 主控看板

### P0 - 立即處理：上架阻塞

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| Google Play internal testing | 未完成 | 建立 Play Console internal testing，補資料安全、內容分級、截圖與商店欄位 | internal testing 可發布 |
| iOS build / TestFlight | blocked | 取得 macOS / Xcode / Apple signing 後執行 build、provisioning、TestFlight | Xcode build 與 TestFlight build 通過 |

### P1 - 近期處理：多人、AI、核心風險

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| LAN protocol hardening | 自動化首輪完成 | 保留雙機長時間 reconnect / snapshot 驗證；下一個 AI 可直接處理項目改為 AI / simulator 對齊 | `test:network`、`test:smoke`、`test:mobile`、`app:check` |
| AI / simulator 對齊檢查 | parity preflight 完成 | 若近期再改 `game.js`、UI、replay、ES modules 或 timing，重跑同一組 preflight | `simulate:ai-cross` 小樣本與 browser auto-battle 錄製通過 |
| 策略套用判斷 | 已檢查，不套用 | 不套用 2026-05-10 overnight 與 2026-05-16 progress-test 輸出；新策略需重新通過 target-vs-field gate | `comparison.md` 與 `evaluate:strategy-gate` 均不能出現不可接受負 delta |
| AI 效能優化 | 等待 profiling | 只針對有量測證據的熱點評估 bitset / allocation cleanup | 有前後 timing 對比，行為差異可解釋 |

### P2 - 後續整理：架構與維護性

| 項目 | 狀態 | 下一步 | 完成標準 |
| --- | --- | --- | --- |
| 核心 facade / ES modules | Phase 1 borders 完成 | platform web/mobile、`state.js`、`dom.js`、`network.js`、`about.js` 已建立 script-compatible window/facade borders；`dom.js` 新增 `HexSnakeDOM` facade；下一步做 helper extraction | build、quick、smoke、audit 通過 |
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
| 素材壓縮與部署瘦身 | `dist` 約 26.92 MB，WebP / M4A 轉檔與 forbidden asset 檢查已納入 build | `check:assets`、`check:size` |
| 文字與編碼檢查 | `text:check` 可掃描 README、HTML、JS、JSON、文件與工具 | `text:check` |
| Browser / mobile smoke | `tools/smoke-test.js`、`mobile-smoke-test.js` 已覆蓋主要 UI 與 replay | `test:smoke`、`test:mobile` |
| LAN protocol hardening 首輪 | 2026-05-20 加入 room lifecycle、sequence number、latency telemetry、relay ack、reconnect / rejoin、snapshot throttling 與 server room routing test | `test:network`、`test:smoke`、`test:mobile` |
| AI / simulator parity preflight | 2026-05-20 執行 `simulate:ai-cross -- --runs 5 --jobs 1 --seed sim-game-parity-smoke-20260520`，並以 `record-mobile-auto-battle.js` 錄製 1 段 12 秒 browser auto battle；未發現啟動或 console 阻塞 | 近期改 AI / timing / UI 後重跑；策略套用仍需正式 `comparison.md` gate |
| AI strategy apply gate 檢查 | 2026-05-20 檢查 2026-05-10 overnight：整體 +1.0% 但 dragon -4.4%，moray/lobster/gu_king qualified 不足；2026-05-16 progress-test 樣本過小且 delta -50%；dragon repair 長跑只到 partial checkpoint，不作 gate；dragon fast gate probe 前 3 候選最佳仍 -1.0% | 不套用；保留 `reports/strategy-gate-dragon-20260520-fast/target-gate.md` 作為證據 |
| Legacy global audit 刷新 | 2026-05-20 `npm run audit:globals` 產出 13 files / 780 cross-file reads；`network.js` 無 detected consumers，主要風險集中於 `game.js` 與 `ui.js` 的互讀 | 後續 facade / ES modules 先切 API 邊界，不先改規則 |
| `game.js` facade 首輪 | 2026-05-20 建立 `HexSnakeGame` facade，將 `characters.js`、`replay.js`、`stats.js` 的 game API 呼叫收斂到單一入口；`audit:globals` 從 780 降至 772 cross-file reads | 已接續完成 `ui.js`、`render.js`、`ai.js` 收斂 |
| `ui.js` facade 第二輪 | 2026-05-20 將 tutorial、rules modal、portrait select、GM 起始資源、auto-battle interval 等執行期 game API 改走 `HexSnakeGame`；保留載入期 `loadKeybinds`、`normalizeAutoBattleSpeed`、tutorial slide `keyLabel` 以避開 TDZ；`audit:globals` 從 772 降至 760 cross-file reads | 已接續完成 `render.js`、`ai.js` 收斂 |
| `render.js` facade 第三輪 | 2026-05-20 將座標、hex path、方向/路徑、攻擊視覺與效能 overlay 等 game API 改走 `HexSnakeGame`；`audit:globals` 從 760 降至 742 cross-file reads | 下一步不再盲目搬呼叫，先清點 state 邊界 |
| `ai.js` facade 第四輪 | 2026-05-20 將 AI 決策使用的距離、攻擊統計、傷害、轉向、施放攻擊與狀態更新等 game API 改走 `HexSnakeGame`；`audit:globals` 從 742 降至 723 cross-file reads | 下一步清點 `game.js` 對 `ui.js` 的大量狀態讀寫 |
| State boundary audit | 2026-05-20 新增 `npm run audit:state-boundary` 與 `doc/state-boundary-audit.md`；盤點 `game.js` 對 `ui.js` 有 1535 references、261 names、423 direct writes/mutations；最大群組是 match runtime state 719 occurrences / 83 names | 下一輪先建立 match runtime state 讀寫入口，再切 combat/resource state |
| Match runtime state 首輪 | 2026-05-20 將 `running`、`paused`、`gameOver` 包成 `HexSnakeState.game` getter/setter，並讓 `game.js` 改走 accessor；`audit:globals` 從 723 降至 721，`audit:state-boundary` 從 1535/261 降至 1402/258 | 已接續完成 match collections 第二輪 |
| Match collections 第二輪 | 2026-05-20 將 `snake`、`computerSnake`、`foods`、`hazards`、`projectiles`、`blasts` 包成 `HexSnakeState.game` getter/setter，並讓 `game.js` 直接集合存取清零；`audit:globals` 從 721 降至 715，`audit:state-boundary` 從 1402/258 降至 1249/252 | 已接續完成 combat/resource state 首輪 |
| Combat/resource state 首輪 | 2026-05-20 將 HP、stock、ammo、stun/slow/vulnerability、collision paralysis、sandworm underground / super armor、attack cooldown trackers 包成 `HexSnakeState.game` getter/setter；`audit:globals` 從 715 降至 689，`audit:state-boundary` 從 1249/252 降至 1120/226 | 已接續完成 runtime/session state 第二輪 |
| Runtime/session state 第二輪 | 2026-05-20 將 score、match timers、step timers、visible snake memory、food target tracking、auto-battle / relay、game-over settlement state 包成 `HexSnakeState.game` getter/setter；`audit:globals` 從 689 降至 660，`audit:state-boundary` 從 1120/226 降至 939/197 | 已接續完成角色/方向/timer state |
| 角色/方向/timer state | 2026-05-20 將 character choice/id、computer difficulty、dir/nextDir/computerDir、energy/bomb flashes、hold/preview timers 包成 `HexSnakeState.game` getter/setter；`audit:globals` 從 660 降至 645，`audit:state-boundary` 從 939/197 降至 817/182 | 已接續完成 controls/settings state 首輪 |
| Controls/settings state 首輪 | 2026-05-20 將 grid/food/speed/GM settings、keybinds、keyboard aim/preview、target 與 joystick pointer state 包成 `HexSnakeState.game` getter/setter；`audit:globals` 從 645 降至 631，`audit:state-boundary` 從 817/182 降至 668/168 | 已接續完成 presentation/actions API 首輪 |
| Presentation/actions API 首輪 | 2026-05-20 建立 `HexSnakeUI` facade，將 `game.js` 對 portrait、tutorial、rules、result share、callouts、character stage 的 UI 動作呼叫收斂到單一入口；`audit:globals` 從 631 降至 600，`audit:state-boundary` 從 668/168 降至 564/135 | 已接續完成 presentation state 首輪 |
| Presentation state 首輪 | 2026-05-20 將 result share、tutorial / portrait swipe、start logo countdown、logo transition duration 與 replay record timing 改走 `HexSnakeState.ui`；`audit:globals` 從 600 降至 580，`audit:state-boundary` 從 564/135 降至 471/115，direct writes 從 109 降至 51 | 已接續完成 character catalog API |
| Character catalog API | 2026-05-20 新增 `HexSnakeUI` catalog query，收斂 `game.js` 對 `characters`、`characterById`、`randomCharacterChoiceId` 的直接讀取；`audit:globals` 從 580 降至 577，`audit:state-boundary` 從 471/115 降至 438/112，presentation/actions 群組清零 | 下一輪處理 misc/render runtime state：`cells`、layout、board shake、`rafId`、relay counters |
| Misc/render runtime state | 2026-05-20 將 `cells`、`cellSize`、`center`、board shake、`rafId`、relay mode/counters、`restartUnlockAt`、`keyToDir` 與 FPS preference 接到 `HexSnakeState.game/ui`；`audit:globals` 從 577 降至 562，`audit:state-boundary` 從 438/112 降至 361/97，direct writes 從 50 降至 22 | 下一輪處理 attack/input pointer state 與 best timers |
| Attack/input pointer state | 2026-05-20 將 `selectedAttackProfile`、`highlightedAttackProfile`、`attackPointer`、`controlAttackPointer`、`attackButtonPointerId`、`best` 與 `bestTotalMs` 接到 `HexSnakeState.game`；`audit:globals` 從 562 降至 556，`audit:state-boundary` 從 361/97 降至 280/90，direct writes 從 22 降至 0 | 下一輪處理 read-only config/constants API 與 helper facade |
| Read-only config/helper facade | 2026-05-20 新增 `HexSnakeState.config`，將 default settings/keybinds、directions/food types、auto speed、attack/resource constants 改走 getter，並將 attack/resource helper calls 接到 `HexSnakeUI` facade；`audit:globals` 從 556 降至 486，`audit:state-boundary` 從 280/90 降至 67/20，function refs 清零 | 下一輪檢查剩餘 67 refs 是否為 object keys / accessor property false-positive，必要時精修 audit |
| State boundary cleanup | 2026-05-20 精修 `audit-state-boundary`，排除 object key、函式參數與區域 binding false-positive；同步修正 projectile radiation branch 的 `radius` -> `explosionRadius` 殘留；`audit:state-boundary` 從 67/20 降至 0/0 | 下一輪進 ES module split 前 dependency map，先決定 `ui.js` / `game.js` 切分順序 |
| ES module split dependency map | 2026-05-20 新增 `doc/es-module-split-map.md`，將 `audit:globals` 的 486 cross-file reads 分成 foundation、leaf services、catalog/media/stats、runtime helpers、core knot，並排定 Phase 1-5 | 下一輪 AI 可直接處理 Phase 1 low-risk module borders：`state.js`、`dom.js`、`network.js`、`about.js` |
| ES module Phase 1 module borders | 2026-05-20 為 platform web/mobile、`state.js`、`dom.js`、`network.js`、`about.js` 補上 script-compatible window/facade borders；`dom.js` 新增 `HexSnakeDOM` facade；`audit:globals` 維持 486，`audit:state-boundary` 維持 0/0 | 下一輪做 Phase 2 helper extraction：先移出 `keyLabel`、`loadKeybinds`、`normalizeAutoBattleSpeed` |
| Release gate | `release:check` 串接 build、text、data、assets、size、quick、network、mobile、smoke、offline、app readiness | `release:check` |
| App shell 基礎封裝 | Capacitor 8、Android / iOS 專案、mobile platform adapter、APK / AAB build scripts 已建立 | `app:check`、Android build scripts |
| Android 實機驗證 | 2026-05-20 使用者確認 debug APK 實機測試正常，返回鍵、背景暫停 / 恢復、震動、音效 unlock 與長時間效能無問題 | 後續版本若改 platform adapter 或原生設定，再重測 |
| Android 正式簽章 | 2026-05-20 建立 `android/hex-snake-upload.jks` 與 gitignored `android/signing.properties`，`npm run android:bundle:signed` 成功產出 signed release AAB | 後續正式上傳前保護 upload keystore 與簽章密碼 |
| 商店草稿與本機檢查 | listing、privacy policy、release checklist 與 `store:check` 已建立 | `store:check` |

## 衝突整理

舊文件中有幾處狀態已被新進度覆蓋，這裡統一判定：

- `doc/follow-up-execution-list.md` 舊版曾將「PWA 與離線遊玩」列為未開始，但 `pre-app-optimization-plan.md`、`app-deployment-plan.md` 與現有腳本已顯示 PWA / service worker / offline fallback 已完成並納入 `app:check`。主控狀態以「已完成」為準。
- `pre-app-optimization-plan.md` 的 `dist` 舊基準曾是 153.77 MB；目前主控採最新 App 計畫與 release check 結果，約 26.92 MB。
- `doc/follow-up-execution-list.md` 的 P0 safety nets 已大多完成，剩餘只作為歷史與細節來源；active 待辦以本文件 P0/P1/P2/P3 為準。
- `reports/` 中的策略輸出只代表當次模擬結果。是否套用策略，以 `doc/strategy-optimization-sop.md` 的 apply gate 與本文件主控判斷為準。

## 順序檢查

目前安排合理，原因如下：

1. Android 實機驗證與正式簽章已完成，現在可以進入 Play internal testing。
2. Play internal testing 排在更大範圍產品開發前，因為它會暴露商店後台、資料安全、內容分級與上傳格式等真正上架阻塞。
3. iOS 目前被環境阻塞，因此不阻擋 Android 主線；取得 macOS / Xcode 後可與 Android Play 後台並行。
4. LAN protocol hardening 的 AI 可處理首輪已完成；剩餘雙機長時間驗證屬裝置測試，不阻擋下一個 AI 可直接處理項目。
5. AI / simulator 對齊排在策略套用與共用規則核心之前，因為尚未確認差異前，直接套策略或抽共用核心都容易把錯誤固定下來。
6. Facade / ES modules 排在共用規則核心之前，因為先清楚模組邊界，再抽共享純函式，回歸風險較低；目前 `ui.js`、`render.js`、`ai.js` 可安全移動的執行期 game API 已完成，`running`、`paused`、`gameOver`、match collections、combat/resource state、runtime/session state、角色/方向/timer state、controls/settings state、presentation/actions API、presentation state、character catalog API、misc/render runtime state、attack/input pointer state、read-only config/helper facade、state-boundary audit cleanup、ES module split dependency map 與 Phase 1 module borders 已完成，下一步做 Phase 2 helper extraction。
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
npm.cmd run test:network
npm.cmd run audit:state-boundary
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
npm.cmd run evaluate:strategy-gate -- --character <id> --candidates <candidate-json> --runs 10 --top 3
```

需要完整策略訓練或套用時，依 `doc/strategy-optimization-sop.md` 執行。

## 下一輪建議順序

1. 建立 Google Play internal testing，補資料安全、內容分級、截圖與商店欄位，並上傳 signed release AAB。
2. 找 macOS / Xcode 環境執行 iOS build 與 TestFlight；若環境已備妥，可與第 1 步並行。
3. LAN 多人剩餘雙機長時間 reconnect / snapshot 驗證；若通過，再規劃 WebRTC DataChannel。
4. 執行 ES module split Phase 2：先移出 `keyLabel`、`loadKeybinds`、`normalizeAutoBattleSpeed` 的 `ui.js -> game.js` late dependency，再用 `HexSnakeDOM` facade 分批降低 `game.js -> dom.js` direct reads。
5. 若之後要繼續 AI 訓練，先以 dragon / gu_king 為目標重跑完整 target-vs-field gate，不直接套用既有輸出。
6. 最後再做 replay 分享、每日挑戰與觀戰聯賽。
