# Hex Snake Project Management

更新日期：2026-05-21（Asia/Taipei）

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
| 架構整理 | Phase D service module migration 小切片進行中 | platform/runtime、state registry、DOM、UI shell、leaf services、catalog/media/stats、runtime helpers 與 game shell 已具備 dual-mode exports；`test:module-loader` 已固定 source module / shadow 與 dist fallback；production 維持 `bundled-legacy-fallback`；`state.js` controls storage、`ui.js` controls helper / registry self-reads、`stats.js` / `audio.js` / `replay.js` / `ai.js` / `render.js` root state、`game.js` control-profile / saved character choice / keybind / attack button highlight / settings perf overlay / settings clamp GM parameters / GM presets settings action / board geometry helper / reset game setup / result share helper / start logo countdown / skip logo transition / start game entry / auto start game / return to start screen / open game over character select / random food generation helper / update stock HUD helper / cooldown indicator helper / update HUD helper / replay snapshot throttle helper / auto battle speed menu helper / auto battle relay control state / game-over relay settlement / network helper / sandworm status helper / turn/direction helper / attack stats direction vector helper / lobster path nearby cells helper / attack visual circle projectile helper / Gu King lobster volley helper / character big attack scheduler helper / launch attack helper / damage / vulnerability helper / attack stun / slow helper / vulnerability collision paralysis helper / projectile resolver helper / projectile blast visual helper / game-over visual advance helper / hazard resolver helper / owner movement helper / replace consumed foods helper / step helper / step player-only helper / step computer-only helper alias slices、end game helper coverage、loop helper alias slice、pointer direction helper alias slice、control-pad attack pointer helper alias slice、move stick helper alias slice、target stick helper alias slice、opponent target helper alias slice、keyboard attack direction helper alias slice、keyboard attack hint helper alias slice 與 keyboard aim key helper alias slice、`about.js`、`network.js`、`characters.js` 與 `game.js` aliases 已集中為 explicit import friendly aliases，LAN service 已註冊 `HexSnakeUI.network`，下一步繼續收斂 `game.js` player direct attack helper direct facade reads | `npm run audit:esm-map`、`npm run test:module-loader`、`npm run check:assets`、`npm run audit:globals`、`npm run audit:state-boundary`、`doc/es-module-split-map.md`、`doc/es-module-export-map.md`、`doc/es-module-loader-plan.md`、`doc/es-module-core-bootstrap-checklist.md`、`doc/es-module-production-strategy.md` |
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
| 核心 facade / ES modules | Phase D service module migration 小切片進行中 | replay、render、ai 與 service/runtime facade 已分批收斂；`test:module-loader` 驗證 source `module-shadow` 不啟動 gameplay、source `module` 可啟動初始 UI、dist module flags 仍 fallback 到 bundled legacy；`state.js` controls storage、`ui.js` controls helper / registry self-reads、`stats.js` / `audio.js` / `replay.js` / `ai.js` / `render.js` root state、`game.js` control-profile / saved character choice / keybind / attack button highlight / settings perf overlay / settings clamp GM parameters / GM presets settings action / board geometry helper / reset game setup / result share helper / start logo countdown / skip logo transition / start game entry / auto start game / return to start screen / open game over character select / random food generation helper / update stock HUD helper / cooldown indicator helper / update HUD helper / replay snapshot throttle helper / auto battle speed menu helper / auto battle relay control state / game-over relay settlement / network helper / sandworm status helper / turn/direction helper / attack stats direction vector helper / lobster path nearby cells helper / attack visual circle projectile helper / Gu King lobster volley helper / character big attack scheduler helper / launch attack helper / damage / vulnerability helper / attack stun / slow helper / vulnerability collision paralysis helper / projectile resolver helper / projectile blast visual helper / game-over visual advance helper / hazard resolver helper / owner movement helper / replace consumed foods helper / step helper / step player-only helper / step computer-only helper alias slices、end game helper coverage、loop helper alias slice、pointer direction helper alias slice、control-pad attack pointer helper alias slice、move stick helper alias slice、target stick helper alias slice、opponent target helper alias slice、keyboard attack direction helper alias slice、keyboard attack hint helper alias slice 與 keyboard aim key helper alias slice、`about.js`、`network.js`、`characters.js` 與 `game.js` aliases 已集中為 explicit import friendly aliases；LAN service 已註冊 `HexSnakeUI.network`，game 不再讀 `window.HexSnakeNet`，controls keybind storage 不再讀 `window.HexSnakeStorage`；下一步繼續收斂 `game.js` player direct attack helper direct facade reads | build、quick、smoke、audit 通過 |
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
| Browser / mobile smoke | `tools/smoke-test.js`、`mobile-smoke-test.js` 已覆蓋主要 UI 與 replay；`module-loader-smoke-test.js` 已覆蓋 module loader modes | `test:smoke`、`test:mobile`、`test:module-loader` |
| LAN protocol hardening 首輪 | 2026-05-20 加入 room lifecycle、sequence number、latency telemetry、relay ack、reconnect / rejoin、snapshot throttling 與 server room routing test | `test:network`、`test:smoke`、`test:mobile` |
| AI / simulator parity preflight | 2026-05-20 執行 `simulate:ai-cross -- --runs 5 --jobs 1 --seed sim-game-parity-smoke-20260520`，並以 `record-mobile-auto-battle.js` 錄製 1 段 12 秒 browser auto battle；未發現啟動或 console 阻塞 | 近期改 AI / timing / UI 後重跑；策略套用仍需正式 `comparison.md` gate |
| AI strategy apply gate 檢查 | 2026-05-20 檢查 2026-05-10 overnight：整體 +1.0% 但 dragon -4.4%，moray/lobster/gu_king qualified 不足；2026-05-16 progress-test 樣本過小且 delta -50%；dragon repair 長跑只到 partial checkpoint，不作 gate；dragon fast gate probe 前 3 候選最佳仍 -1.0% | 不套用；保留 `reports/strategy-gate-dragon-20260520-fast/target-gate.md` 作為證據 |
| Legacy global audit 刷新 | 2026-05-20 `npm run audit:globals` 產出 13 files / 780 cross-file reads；`network.js` 無 detected consumers，主要風險集中於 `game.js` 與 `ui.js` 的互讀 | 後續 facade / ES modules 先切 API 邊界，不先改規則 |
| `game.js` facade 首輪 | 2026-05-20 建立 `HexSnakeGame` facade，將 `characters.js`、`replay.js`、`stats.js` 的 game API 呼叫收斂到單一入口；`audit:globals` 從 780 降至 772 cross-file reads | 已接續完成 `ui.js`、`render.js`、`ai.js` 收斂 |
| `ui.js` facade 第二輪 | 2026-05-20 將 tutorial、rules modal、portrait select、GM 起始資源、auto-battle interval 等執行期 game API 改走 `HexSnakeGame`；當時保留載入期 `loadKeybinds`、`normalizeAutoBattleSpeed`、tutorial slide `keyLabel` 以避開 TDZ；後續已由 `HexSnakeControls` 承接 | 已接續完成 `render.js`、`ai.js` 收斂 |
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
| ES module Phase 2 helper extraction | 2026-05-20 新增 `HexSnakeControls`，將 `keyLabel`、`loadKeybinds`、`normalizeAutoBattleSpeed` 移出 `game.js` late dependency；`ui.js -> game.js` 目前只剩 `HexSnakeGame`，`audit:globals` 從 486 降至 485，`audit:state-boundary` 維持 0/0 | 下一輪用 `HexSnakeDOM` facade 先處理 HUD/status/settings DOM reads |
| ES module DOM facade 首批 | 2026-05-20 將 `game.js` 的 HUD/status/target indicator DOM reads 改走 `HexSnakeDOM` facade；`audit:globals` 從 485 降至 467，`audit:state-boundary` 維持 0/0 | 已接續完成 game.js DOM facade 全量收斂 |
| ES module game.js DOM facade | 2026-05-20 將 `game.js` 的 settings/control/modal/replay/overlay/board 等直接 DOM globals 全部改走 `HexSnakeDOM`；`game.js -> dom.js` 目前只剩 `HexSnakeDOM`，`audit:globals` 從 467 降至 367 | 已接續完成 Phase 3 catalog/media/stats cleanup |
| ES module Phase 3 catalog/media/stats cleanup | 2026-05-20 新增 catalog setter/list facade、portrait variant state getter 與 food label config getter；`characters.js`、`audio.js`、`stats.js` 的直接 state / DOM reads 已改走 `HexSnakeState`、`HexSnakeUI`、`HexSnakeDOM`；`audit:globals` 從 367 降至 339，`audit:state-boundary` 維持 0/0 | 下一輪進 Phase 4：先處理 `replay.js` 的 DOM/runtime state reads |
| ES module Phase 4 replay cleanup 首批 | 2026-05-20 將 `replay.js` 的 modal/control/overlay DOM refs 改走 `HexSnakeDOM`，snapshot/restore/playback runtime state 改走 `HexSnakeState.game/ui/replay`，角色名稱與時間/HP/stage helper 改走 `HexSnakeUI`；修正 legacy concatenated loader 下 alias 撞名問題 | `audit:globals` 從 339 降至 304，`audit:state-boundary` 維持 0/0；下一輪處理 `render.js` |
| ES module Phase 4 render cleanup 首批 | 2026-05-20 將 `render.js` 的 canvas/playArea/mobileInputQuery 改走 `HexSnakeDOM`；comparisonLoop `rafId`、board-shake state、visualLoadScale cells length 改走 `HexSnakeState.game`；新增 boardShakeFrequency / boardShakeStyle accessors | `audit:globals` 從 304 降至 297，`audit:state-boundary` 維持 0/0；下一輪處理 `render.js` helper/config state 或 `ai.js` |
| ES module Phase 4 render cleanup 第二批 | 2026-05-20 將 `render.js` 的 colors、food type catalog、foodTypeIds helper、character catalog / owner lookup、elemental sprite cache 與攻擊視覺常數改走 `HexSnakeState.config`、`HexSnakeState.game`、`HexSnakeUI` facade；`characters.js` 對外補 `characterFor` facade | `audit:globals` 從 297 降至 286，`audit:state-boundary` 維持 0/0；下一輪處理 `render.js` board/runtime state 或 `ai.js` |
| ES module Phase 4 render cleanup 第三批 | 2026-05-20 將 `render.js` 的 board collections、cellSize/center、player/computer snake state、direction state、attack preview state、preview cache、preview RAF 與 canAttack/blastRadius helper 改走 `HexSnakeState.game` / `HexSnakeUI`；`render.js -> ui.js` direct reads 已清空 | `audit:globals` 從 286 降至 263，`audit:state-boundary` 維持 0/0；下一輪處理 `ai.js` 純規則/helper reads |
| ES module Phase 4 ai cleanup 首批 | 2026-05-21 將 `ai.js` 的 board cache、food/resource valuation、visibility memory、food target tracking、attack profile/target selection、projectile/hazard threat reads 改走 `HexSnakeState.config`、`HexSnakeState.game`、`HexSnakeUI`；同步補齊 `ammoChargeFor`、resource constants 與 `deadEndMinSpace` facade | `audit:globals` 從 263 降至 206，`audit:state-boundary` 維持 0/0；下一輪處理 `game.js -> ui.js` 剩餘設定/runtime state reads |
| ES module Phase 4 dependency 精修 | 2026-05-21 精修 `audit-legacy-globals`，排除 object keys、object methods、function locals、destructuring locals 與 regex literal 誤判；確認 `game.js -> ui.js` 已無真 direct reads；`audio.js` 角色音效改走 `HexSnakeUI.characterFor`，`about.js` version modal 改走 `HexSnakeDOM` | `audit:globals` 從 206 降至 123，`audit:state-boundary` 維持 0/0；下一輪處理 `ui.js -> dom.js` DOM refs |
| ES module Phase 4 ui DOM facade 首批 | 2026-05-21 在 `ui.js` 建立 `UiDom = HexSnakeDOM`，將 settings inputs、logo/tutorial overlay、portrait lightbox、character stage、winner portrait、resource HUD、canvas/playArea tutorial capture 等 DOM refs 改走 facade | `audit:globals` 從 123 降至 100，`audit:state-boundary` 維持 0/0；下一輪檢查 `characters.js -> game.js` 與 `render.js -> ai/game.js` helper 依賴 |
| ES module Phase 4 helper facade 收斂 | 2026-05-21 擴充 `HexSnakeUI` 角色 helper facade，讓 `ui.js` / `game.js` 不再直接讀 `characters.js` top-level helpers；新增 `HexSnakeAI`，讓 `render.js` / `game.js` 改走 AI helper facade | `audit:globals` 從 100 降至 58，`audit:state-boundary` 維持 0/0；下一輪檢查 `render.js -> game.js` helpers 與 `characters.js -> game.js` late hooks |
| ES module Phase 4 render/helper hooks 收斂 | 2026-05-21 新增 `HexSnakeRenderGame` 早期 facade，讓 `render.js` 的座標、路徑、攻擊視覺、preview helpers 不再 late-read `HexSnakeGame`；`characters.js` 選角 hooks 與 `stats.js` relay timer hook 改走 `HexSnakeUI` | `audit:globals` 從 58 降至 57，`audit:state-boundary` 維持 0/0；下一輪檢查 `replay.js -> game.js` 與 `ai.js -> game.js` remaining hooks |
| ES module Phase 4 replay game hook 收斂 | 2026-05-21 新增 `HexSnakeUI.replayGame` 子 facade，讓 replay modal/playback/restore 對 game lifecycle helpers 的呼叫不再 late-read `HexSnakeGame` | `audit:globals` 從 57 降至 56，`audit:state-boundary` 維持 0/0；下一輪檢查 `ai.js -> game.js` remaining hooks |
| ES module Phase 4 ai game hook 收斂 | 2026-05-21 新增 `HexSnakeUI.aiGame` 子 facade，讓 AI pathfinding/combat/attack helpers 不再 late-read `HexSnakeGame` | `audit:globals` 從 56 降至 55，`audit:state-boundary` 維持 0/0；下一輪檢查 `ui.js -> game.js` facade 與 render draw/public hooks |
| ES module Phase 4 ui/render public hooks 收斂 | 2026-05-21 新增 `HexSnakeUI.uiGame` 與 `HexSnakeRender` facade，讓 UI tutorial/GM/start helpers 不再 late-read `HexSnakeGame`，並讓 UI/replay/game 不再直接讀 render public hooks | `audit:globals` 從 55 降至 51，`audit:state-boundary` 維持 0/0；`render.js` 與 `game.js` 目前無 detected consumers，下一輪檢查 `game.js -> audio/replay/stats/about/ai` service facade 依賴 |
| ES module Phase 4 service facade 收斂 | 2026-05-21 將 audio/replay/stats/about/AI public service 註冊到 `HexSnakeUI.audio/replay/stats/about/ai`，讓 UI/render/game 不再直接讀各 service top-level facade | `audit:globals` 從 51 降至 44，`audit:state-boundary` 維持 0/0；service/runtime/core files 目前無 detected consumers，下一輪整理 platform/storage 依賴與正式 ESM export 形狀 |
| ES module Phase 4 runtime adapter facade 收斂 | 2026-05-21 新增 `HexSnakeRuntime` 作為 platform/storage adapter 單一入口，web/mobile platform 均註冊 `platform` 與 `storage`，一般模組改走本地 runtime alias | `audit:globals` 從 44 降至 42，`audit:state-boundary` 維持 0/0；下一輪確認 `HexSnakeState` / `HexSnakeDOM` / `HexSnakeUI` registry 在正式 ESM 下的初始化順序 |
| ES module Phase 5 registry/export map gate | 2026-05-21 新增 `doc/es-module-export-map.md` 與 `audit:esm-map`，明確記錄 web/mobile legacy loader order、registry 初始化契約、window compatibility registrations 與正式 ESM export surface | `audit:esm-map` 可驗證 `src/main.js`、`build.js`、核心 registry 註冊點與文件涵蓋；下一輪規劃 `src/main.js` loader split |
| ES module Phase 5 loader split plan gate | 2026-05-21 新增 `doc/es-module-loader-plan.md`，定義 `legacy`、`module-shadow`、`module` 三種 loader mode、fallback rules、source order contract 與分階段實作順序，並納入 `audit:esm-map` | 下一輪新增 module shadow entry 與最小 loader flag；不直接 import 尚未 dual-mode 的 gameplay files |
| ES module Phase 5 module shadow entry | 2026-05-21 新增 `src/main-module.js` 與 `?hexSnakeLoader=module-shadow`，讓 local dev 可載入 native module shadow contract；預設仍為 legacy loader，production bundle 遇 shadow flag 仍回到 legacy | `audit:esm-map` 驗證 shadow source order、flag、entry 與「不 import gameplay」契約；下一輪處理 platform/runtime 與 state registry dual-mode exports |
| ES module Phase 5 runtime/state dual-mode exports | 2026-05-21 `src/platform/web.js` / `src/platform/mobile.js` export `runtime`、`platform`、`storage`；`src/state.js` export `state`、`uiRegistry`、`render`、`renderGame`、`controls`；`src/main-module.js` import 這些 shell 並維持 no-gameplay contract | `audit:esm-map` 驗證 exports、shadow imports 與 banned gameplay imports；下一輪處理 `src/dom.js` dual-mode `dom` export |
| ES module Phase 5 DOM dual-mode export | 2026-05-21 `src/dom.js` export `dom` / `HexSnakeDOM`，`src/main-module.js` import DOM facade shell 並於 shadow contract 回報 `domReady` | `audit:esm-map` 驗證 DOM export 與 shadow import；下一輪處理 `src/network.js` / `src/about.js` service shell exports |
| ES module Phase 5 network/about service exports | 2026-05-21 `src/network.js` export `network` / `HexSnakeNet`，`src/about.js` export `about` / `HexSnakeAbout`，`src/main-module.js` import leaf service shell 並於 shadow contract 回報 `serviceReady` | `audit:esm-map` 驗證 service exports、shadow imports 與 banned gameplay imports；下一輪處理 catalog/media/stats shell exports |
| ES module Phase 5 catalog/media/stats exports | 2026-05-21 `src/characters.js` export `characterCatalog` / `HexSnakeCharacters`，`src/audio.js` export `audio` / `HexSnakeAudio`，`src/stats.js` export `stats` / `HexSnakeStats`；`src/main-module.js` import catalog/media/stats shell 並回報 `catalogReady`、`mediaReady`、`statsReady` | `audit:esm-map` 驗證 shell exports、shadow imports 與 banned gameplay imports；下一輪檢查 `src/replay.js` / `src/ai.js` / `src/render.js` runtime helper shell exports |
| ES module Phase 5 runtime helper exports | 2026-05-21 `src/replay.js` export `replay` / `HexSnakeReplay`，`src/ai.js` export `ai` / `HexSnakeAI`，`src/render.js` export `renderHooks` / `HexSnakeRenderHooks`；`src/main-module.js` import runtime helper shell 並回報 `replayReady`、`aiReady`、`renderReady` | `audit:esm-map` 驗證 shell exports、shadow imports 與仍禁止 `ui.js` / `game.js`；下一輪盤點 core module blockers |
| ES module Phase 5 core bootstrap checklist | 2026-05-21 新增 `doc/es-module-core-bootstrap-checklist.md`，盤點 `src/ui.js` / `src/game.js` 的 module blockers、explicit import surface、bootstrap ownership 與 module-mode preflight gate | 已接續完成 `uiCore` 與 `gameShell` exports；後續維護 checklist 作為 module bootstrap gate |
| ES module Phase 5 uiCore shell export | 2026-05-21 `src/ui.js` export `uiCore` / `HexSnakeUICore`，`src/main-module.js` import UI shell 並回報 `uiReady`；當時 module-shadow 仍禁止 `src/game.js`、不啟動 gameplay | 已接續完成 `gameShell` / `bootstrapGame()` export；保留作為 UI shell 歷史證據 |
| ES module Phase 5 game shell export | 2026-05-21 `src/game.js` export `gameShell` / `HexSnakeGame`、`loadGameShell()` 與 `bootstrapGame()`；legacy default 仍自動 bootstrap，`module-shadow` import game shell 並回報 `gameReady` 但不呼叫 bootstrap | 已接續完成正式 `module` bootstrap owner；保留作為 game shell 歷史證據 |
| ES module Phase 5 module bootstrap owner | 2026-05-21 `src/main-module.js` 新增 `loadModuleGame()`，`src/main.js` 的 `hexSnakeLoader=module` 路徑改由它呼叫 `gameShell.bootstrapGame()`；同步收斂 `characters.js` owner colors 與 `render.js` board radius 的 module-scope 依賴；production bundle 繼續 fallback 到 legacy | 已接續完成 module loader smoke gate；保留作為 module owner 歷史證據 |
| ES module Phase 5 module loader smoke gate | 2026-05-21 新增 `tools/module-loader-smoke-test.js` 與 `npm run test:module-loader`，驗證 source `module-shadow`、source `module`、dist `module-shadow` fallback、dist `module` fallback；`release:check` 已納入此 gate | 已接續完成 production module strategy；保留作為 module loader gate 歷史證據 |
| ES module Phase 5 production module strategy | 2026-05-21 新增 `doc/es-module-production-strategy.md`，正式決定 production 維持 `bundled-legacy-fallback`；`build.js` 寫入 manifest `moduleLoader` 策略，`check:assets` 驗證 production entrypoint 仍為 `assets/app.bundle.js`，正式 module bundle 須另走 source map gate | 下一輪回到 Phase D service module migration 小切片，不切換 production default |
| ES module Phase D stats service alias slice | 2026-05-21 `src/stats.js` 將 runtime/storage、root/game state、UI registry 與 DOM facade 集中成 `StatsRuntime`、`StatsStorage`、`StatsRootState`、`StatsGameState`、`StatsUI`、`StatsDom` aliases；`audit:esm-map` 固定此 shape | 已接續完成 stats root state alias slice |
| ES module Phase D about service alias slice | 2026-05-21 `src/about.js` 將 platform、UI registry 與 DOM facade 集中成 `AboutRuntime`、`AboutPlatform`、`AboutUI`、`AboutDom` aliases；`audit:esm-map` 固定此 shape | 下一輪挑下一個 leaf service 或 runtime helper 做 explicit import friendly 小切片 |
| ES module Phase D network service alias slice | 2026-05-21 `src/network.js` 將 runtime/storage 集中成 `NetRuntime`、`NetStorage` aliases；`audit:esm-map` 固定此 shape，`test:network` 驗證 LAN relay room routing | 已接續完成 network registry slice |
| ES module Phase D audio service alias slice | 2026-05-21 `src/audio.js` 將 runtime/storage、root/audio/UI state、UI registry 與 DOM facade 集中成 `AudioRuntime`、`AudioStorage`、`AudioRootState`、`AudioState`、`AudioUiState`、`AudioUI`、`AudioDom` aliases；`audit:esm-map` 固定此 shape | 已接續完成 audio root state alias slice |
| ES module Phase D characters service alias slice | 2026-05-21 `src/characters.js` 將 state、game/ui/config state、UI registry 與 DOM facade 集中成 `CharacterState`、`CharacterGameState`、`CharacterUiState`、`CharacterConfig`、`CharacterUI`、`CharacterDom` aliases；`audit:esm-map` 固定此 shape | 下一輪挑下一個 leaf service 或 runtime helper 做 explicit import friendly 小切片 |
| ES module Phase D replay helper alias slice | 2026-05-21 `src/replay.js` 將 runtime/platform/storage、root/game/ui/replay state、replay UI registry 與 replay game hooks 集中成 `ReplayRuntime`、`ReplayPlatform`、`ReplayStorage`、`ReplayRootState`、`GameState`、`UiState`、`ReplayState`、`ReplayUI`、`ReplayGame` aliases；`audit:esm-map` 固定此 shape | 已接續完成 replay root state alias slice |
| ES module Phase D ai helper alias slice | 2026-05-21 `src/ai.js` 將 runtime/storage、root/config/game state、AI UI registry 與 AI game hooks 集中成 `AiRuntime`、`AiStorage`、`AiRootState`、`AiConfig`、`AiState`、`AiUI`、`AiGame` aliases；`audit:esm-map` 固定此 shape | 已接續完成 ai root state alias slice |
| ES module Phase D render helper alias slice | 2026-05-21 `src/render.js` 將 runtime/platform、root/config/game state、DOM、UI、AI/replay registry 與 render hooks 集中成 `RenderRuntime`、`RenderPlatform`、`RenderRootState`、`RenderConfig`、`RenderState`、`RenderDom`、`RenderUI`、`RenderAI`、`RenderReplay`、`RenderHooks` aliases；`audit:esm-map` 固定此 shape | 已接續完成 render root state alias slice |
| ES module Phase D ui shell alias slice | 2026-05-21 `src/ui.js` 將 runtime/storage、state/config/game/ui registry、DOM、audio/replay/game/render hooks 集中成 `UiRuntime`、`UiStorage`、`UiRootState`、`UiConfig`、`UiGameState`、`UiPresentationState`、`UiRegistry`、`UiDom`、`UiAudio`、`UiReplay`、`UiGame`、`UiRender` aliases；`audit:esm-map` 固定此 shape | 下一輪挑下一個 service/helper 或 core shell 做 explicit import friendly 小切片 |
| ES module Phase D game shell alias slice | 2026-05-21 `src/game.js` 將 controls、runtime/platform/storage、state/config/ui registry、DOM、render/game hooks 與 public service registries 集中成 `Game*` aliases；`audit:esm-map` 固定此 shape | 下一輪盤點剩餘 direct window/facade reads，挑下一個 low-risk helper 或 import preflight 小切片 |
| ES module Phase D network registry slice | 2026-05-21 新增 `HexSnakeUI.network` registry，`src/network.js` 將 `HexSnakeNet` descriptors 註冊到此 registry，`src/game.js` 的 LAN adapter 改走 `GameUI.network`；`window.HexSnakeNet` 保留 legacy 相容 | `audit:globals` 為 43（新增 1 個 approved registry read），`audit:state-boundary` 維持 0/0；下一輪繼續盤點 direct window/facade reads |
| ES module Phase D state controls storage slice | 2026-05-21 `src/state.js` 將 `HexSnakeControls.loadKeybinds()` 的 storage 來源改走 `StateRuntime` / `StateStorage` aliases，不再讀 `window.HexSnakeStorage` | `audit:globals` 為 44（新增 1 個 approved runtime alias read），`audit:state-boundary` 維持 0/0；下一輪繼續盤點 direct window/facade reads |
| ES module Phase D ui controls alias slice | 2026-05-21 `src/ui.js` 新增 `UiControls` alias，將 keybind 載入、自動戰鬥速度與 key label helper 改走本地 controls alias | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；下一輪繼續盤點 direct facade reads |
| ES module Phase D ui registry self-read slice | 2026-05-21 `src/ui.js` 將角色/portrait helper 的 `HexSnakeUI.*` self-references 改走 `UiRegistry.*`，並以 `audit:esm-map` 禁止新增 `HexSnakeUI.` property reads | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；下一輪繼續盤點剩餘 direct facade reads |
| ES module Phase D stats root state alias slice | 2026-05-21 `src/stats.js` 將 game state 來源拆成 `StatsRootState` / `StatsGameState`，避免直接以 `HexSnakeState.game` 作為 service state alias | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；下一輪可套用到下一個 leaf service state alias |
| ES module Phase D audio root state alias slice | 2026-05-21 `src/audio.js` 將 audio/ui state 來源拆成 `AudioRootState` / `AudioState` / `AudioUiState`，避免直接以 `HexSnakeState.audio/ui` 作為 service state alias | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；下一輪可套用到下一個 leaf service state alias |
| ES module Phase D replay root state alias slice | 2026-05-21 `src/replay.js` 將 game/ui/replay state 來源拆成 `ReplayRootState` / `GameState` / `UiState` / `ReplayState`，避免直接以 `HexSnakeState.game/ui/replay` 作為 replay helper state alias | 已接續完成 ai root state alias slice |
| ES module Phase D ai root state alias slice | 2026-05-21 `src/ai.js` 將 config/game state 來源拆成 `AiRootState` / `AiConfig` / `AiState`，避免直接以 `HexSnakeState.config/game` 作為 AI helper state alias | 已接續完成 render root state alias slice |
| ES module Phase D render root state alias slice | 2026-05-21 `src/render.js` 將 config/game state 來源拆成 `RenderRootState` / `RenderConfig` / `RenderState`，避免直接以 `HexSnakeState.config/game` 作為 render helper state alias | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；下一輪可盤點剩餘 direct window/facade reads 或挑 import preflight 小切片 |
| ES module Phase D game control-profile alias slice | 2026-05-21 `src/game.js` 的 control-profile 套用/儲存流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 saved character choice alias slice |
| ES module Phase D game saved character choice alias slice | 2026-05-21 `src/game.js` 的 saved character choice / start resolve 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 keybind alias slice |
| ES module Phase D game keybind alias slice | 2026-05-21 `src/game.js` 的 keybind apply / pending direction keybind 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 attack button highlight alias slice |
| ES module Phase D game attack button highlight alias slice | 2026-05-21 `src/game.js` 的 attack button highlight / selected attack profile 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 settings / perf overlay alias slice |
| ES module Phase D game settings perf overlay alias slice | 2026-05-21 `src/game.js` 的 left-hand / low-power / perf overlay 流程改走 `GamePresentationState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 settings clamp / GM parameters alias slice |
| ES module Phase D game settings clamp GM parameters alias slice | 2026-05-21 `src/game.js` 的 clamp / build cells / GM settings 參數流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 GM presets / settings action alias slice |
| ES module Phase D game GM presets settings action alias slice | 2026-05-21 `src/game.js` 的 GM preset / settings action mode 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 board geometry helper alias slice |
| ES module Phase D game board geometry helper alias slice | 2026-05-21 `src/game.js` 的 board geometry / resize helper 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 reset game setup alias slice |
| ES module Phase D game reset game setup alias slice | 2026-05-21 `src/game.js` 的 resetGame setup 流程改走 `GameRuntimeState`、`GamePresentationState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 result share helper alias slice |
| ES module Phase D game result share helper alias slice | 2026-05-21 `src/game.js` 的 result share helper 流程改走 `GameRuntimeState`、`GamePresentationState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 start logo countdown alias slice |
| ES module Phase D game start logo countdown alias slice | 2026-05-21 `src/game.js` 的 start logo countdown 流程改走 `GameRuntimeState`、`GamePresentationState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 skip logo transition alias slice |
| ES module Phase D game skip logo transition alias slice | 2026-05-21 `src/game.js` 的 skipLogoTransition 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 start game entry alias slice |
| ES module Phase D game start game entry alias slice | 2026-05-21 `src/game.js` 的 startGame entry / startup setup 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 auto start game alias slice |
| ES module Phase D game auto start game alias slice | 2026-05-21 `src/game.js` 的 autoStartGame 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 return to start screen alias slice |
| ES module Phase D game return to start screen alias slice | 2026-05-21 `src/game.js` 的 returnToStartScreen 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 open game over character select alias slice |
| ES module Phase D game open game over character select alias slice | 2026-05-21 `src/game.js` 的 openGameOverCharacterSelect 流程改走 `GameRuntimeState`、`GamePresentationState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 random food generation helper alias slice |
| ES module Phase D game random food generation helper alias slice | 2026-05-21 `src/game.js` 的 randomFoodType / randomFoodTypeIds / randomFoodTypeIdsForCharacter / placeFoods 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 update stock HUD helper alias slice |
| ES module Phase D game update stock HUD helper alias slice | 2026-05-21 `src/game.js` 的 updateStockHud 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 cooldown indicator helper alias slice |
| ES module Phase D game cooldown indicator helper alias slice | 2026-05-21 `src/game.js` 的 cooldownTimerText / updateCooldownIndicator / updateCooldownHud / updateSkillPrepVisibility 流程改走 `GameUI` / `GameReplay` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 update HUD helper alias slice |
| ES module Phase D game update HUD helper alias slice | 2026-05-21 `src/game.js` 的 updateHud / updateHudThrottled 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；已接續完成 replay snapshot throttle helper alias slice |
| ES module Phase D game replay snapshot throttle helper alias slice | 2026-05-21 `src/game.js` 的 recordReplaySnapshotThrottled 流程改走 `GamePresentationState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 auto battle speed menu helper alias slice |
| ES module Phase D game auto battle speed menu helper alias slice | 2026-05-21 `src/game.js` 的 auto-battle speed menu render / speed setter / speed index helper 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 auto battle / relay control state alias slice |
| ES module Phase D game auto battle relay control state alias slice | 2026-05-21 `src/game.js` 的 auto-battle timer reset、auto-control active checks、relay mode / score controls、auto-control panel 與 manual override 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 game-over relay settlement alias slice |
| ES module Phase D game game-over relay settlement alias slice | 2026-05-21 `src/game.js` 的 showGameOverSettlement / endGame result, relay restart, stats, logo transition 與 replay settlement 流程改走 `GameRuntimeState`、`GameConfig`、`GamePresentationState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 network helper alias slice |
| ES module Phase D game network helper alias slice | 2026-05-21 `src/game.js` 的 LAN snapshot / start / input / guest snapshot helper 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 sandworm status helper alias slice |
| ES module Phase D game sandworm status helper alias slice | 2026-05-21 `src/game.js` 的 sandwormUndergroundAlpha / isOwnerSandwormArmored / clearOwnerAbnormalStatus / refreshSandwormProtections 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 turn/direction helper alias slice |
| ES module Phase D game turn/direction helper alias slice | 2026-05-21 `src/game.js` 的 canTurn / canComputerTurn / canOwnerTurn / nextCell / directionalAttackTarget / setDirection 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 attack stats / direction vector helper alias slice |
| ES module Phase D game attack stats direction vector helper alias slice | 2026-05-21 `src/game.js` 的 attackStats / ownerDirection / directionVector / directionFromSourceToTarget / turnDistance 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 lobster path / nearby cells helper alias slice |
| ES module Phase D game lobster path nearby cells helper alias slice | 2026-05-21 `src/game.js` 的 cellsForwardFrom / boardLineThrough / lobsterFistDirection / lobsterFistPath / cellsNearCells 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 attack visual / circle projectile helper alias slice |
| ES module Phase D game attack visual circle projectile helper alias slice | 2026-05-21 `src/game.js` 的 attackVisualType / characterForVisualType / burstVisualType / triggerSmallHitShake / pushCircleAttack 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 Gu King / lobster volley helper alias slice |
| ES module Phase D game Gu King lobster volley helper alias slice | 2026-05-22 `src/game.js` 的 guKingBestDamageStep / scheduleLobsterPalmVolley / lobsterPalmVulnerabilityChance / attackHitStunChances 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 character big attack scheduler alias slice |
| ES module Phase D game character big attack scheduler alias slice | 2026-05-22 `src/game.js` 的 scheduleCharacterBigAttack 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 launch attack helper alias slice |
| ES module Phase D game launch attack helper alias slice | 2026-05-22 `src/game.js` 的 launchAttack 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 damage / vulnerability helper alias slice |
| ES module Phase D game damage vulnerability helper alias slice | 2026-05-22 `src/game.js` 的 damageSnake / vulnerability / interruptCasting 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 attack stun / slow helper alias slice |
| ES module Phase D game attack stun / slow helper alias slice | 2026-05-22 `src/game.js` 的 applyAttackStun / applyAttackSlow 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 vulnerability / collision paralysis helper alias slice |
| ES module Phase D game vulnerability collision paralysis helper alias slice | 2026-05-22 `src/game.js` 的 applyVulnerability / applyCollisionPenalty / applyCollisionParalysis 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 projectile resolver helper alias slice |
| ES module Phase D game projectile resolver helper alias slice | 2026-05-22 `src/game.js` 的 resolveProjectiles 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 projectile blast visual helper alias slice |
| ES module Phase D game projectile blast visual helper alias slice | 2026-05-22 `src/game.js` 的 addProjectileBlastVisual / addProjectileImpactVisual 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 game-over visual advance helper alias slice |
| ES module Phase D game game-over visual advance helper alias slice | 2026-05-22 `src/game.js` 的 advanceGameOverVisuals 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 hazard resolver helper alias slice |
| ES module Phase D game hazard resolver helper alias slice | 2026-05-22 `src/game.js` 的 resolveHazards 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 owner movement helper alias slice |
| ES module Phase D game owner movement helper alias slice | 2026-05-22 `src/game.js` 的 advanceOwnerMovement 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 replace consumed foods helper alias slice |
| ES module Phase D game replace consumed foods helper alias slice | 2026-05-22 `src/game.js` 的 replaceConsumedFoods 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 step helper alias slice |
| ES module Phase D game step helper alias slice | 2026-05-22 `src/game.js` 的 step 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 step player-only helper alias slice |
| ES module Phase D game step player-only helper alias slice | 2026-05-22 `src/game.js` 的 stepPlayerOnly 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 step computer-only helper alias slice |
| ES module Phase D game step computer-only helper alias slice | 2026-05-22 `src/game.js` 的 stepComputerOnly 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續確認 end game helper coverage |
| ES module Phase D game end game helper coverage | 2026-05-22 確認 `src/game.js` 的 endGame 已由既有 game-over relay settlement alias slice 與 `audit:esm-map` 的 `function endGame` -> `function loop` guard 固定，不需新增 code 變更 | 已接續完成 loop helper alias slice |
| ES module Phase D game loop helper alias slice | 2026-05-22 `src/game.js` 的 loop 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 pointer direction helper alias slice |
| ES module Phase D game pointer direction helper alias slice | 2026-05-22 `src/game.js` 的 pointerToDirection / controlPadDirectionFromEvent 流程改走 `GameConfig` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 control-pad attack pointer helper alias slice |
| ES module Phase D game control-pad attack pointer helper alias slice | 2026-05-22 `src/game.js` 的 begin / move / finish / cancel controlPadAttackPointer 流程改走 `GameRuntimeState`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 move stick helper alias slice |
| ES module Phase D game move stick helper alias slice | 2026-05-22 `src/game.js` 的 moveStick / setMoveStickLocked / clear move timers / engageMoveStick / releaseMoveStick 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 target stick helper alias slice |
| ES module Phase D game target stick helper alias slice | 2026-05-22 `src/game.js` 的 moveTargetStick / releaseTargetStick 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 opponent target helper alias slice |
| ES module Phase D game opponent target helper alias slice | 2026-05-22 `src/game.js` 的 opponentHeadTarget / opponentCentroidTarget / opponentNearestFoodTarget / keyboardTargetMode / keyboardAttackTarget 流程改走 `GameRuntimeState`、`GameConfig` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 keyboard attack direction helper alias slice |
| ES module Phase D game keyboard attack direction helper alias slice | 2026-05-22 `src/game.js` 的 keyboardAttackUsesDirection / keyboardAttackDirection / keyboardAttackOptions / clearKeyboardAttackPreviewTimer / keyboardAttackHintLabel / currentKeyboardAimProfile 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 keyboard attack hint helper alias slice |
| ES module Phase D game keyboard attack hint helper alias slice | 2026-05-22 `src/game.js` 的 showKeyboardAttackHint / cycleKeyboardAttackAim 流程改走 `GameRuntimeState`、`GameConfig`、`GameUI` aliases，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | 已接續完成 keyboard aim key helper alias slice |
| ES module Phase D game keyboard aim key helper alias slice | 2026-05-22 `src/game.js` 的 handleKeyboardAimKeyDown / handleKeyboardAimKeyUp / clearKeyboardAimKeyLocks 流程改走 `GameRuntimeState` alias，並以 `audit:esm-map` 固定該 slice 不再直接讀 `HexSnakeState.` / `HexSnakeUI.` | `audit:globals` 維持 44，`audit:state-boundary` 維持 0/0；下一輪可接續 player direct attack helper direct facade reads |
| Module loader smoke stability | 2026-05-21 `tools/module-loader-smoke-test.js` 在 dist fallback contract 驗證後移除 page listeners，並對 transient navigation context retry，避免關頁 / 導覽時的 fetch abort 誤判 | `test:module-loader` 通過 |
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
6. Facade / ES modules 排在共用規則核心之前，因為先清楚模組邊界，再抽共享純函式，回歸風險較低；目前 `ui.js`、`render.js`、`ai.js` 可安全移動的執行期 game API 已完成，`running`、`paused`、`gameOver`、match collections、combat/resource state、runtime/session state、角色/方向/timer state、controls/settings state、presentation/actions API、presentation state、character catalog API、misc/render runtime state、attack/input pointer state、read-only config/helper facade、state-boundary audit cleanup、ES module split dependency map、Phase 1 module borders、Phase 2 helper extraction、game.js DOM facade、Phase 3 catalog/media/stats cleanup、Phase 4 replay cleanup 首批、Phase 4 render cleanup 第三批、Phase 4 ai cleanup 首批、dependency 精修、ui DOM facade 首批、helper facade 收斂、render/helper hooks 收斂、replay game hook 收斂、ai game hook 收斂、ui/render public hooks 收斂、service facade 收斂、runtime adapter facade 收斂、registry/export map gate、loader split plan gate、module shadow entry、runtime/state dual-mode exports、DOM dual-mode export、network/about service exports、catalog/media/stats shell exports、runtime helper shell exports、core bootstrap checklist、`uiCore` shell export、`gameShell` / `bootstrapGame()` export、module bootstrap owner、module loader smoke gate、production module strategy、stats service alias slice、about service alias slice、network service alias slice、audio service alias slice、characters service alias slice、replay helper alias slice、ai helper alias slice、render helper alias slice、ui shell alias slice、game shell alias slice、network registry slice、state controls storage slice、ui controls alias slice、ui registry self-read slice、stats root state alias slice、audio root state alias slice、replay root state alias slice、ai root state alias slice、render root state alias slice、game control-profile alias slice、game saved character choice alias slice、game keybind alias slice、game attack button highlight alias slice、game settings perf overlay alias slice、game settings clamp GM parameters alias slice、game GM presets settings action alias slice、game board geometry helper alias slice、game reset game setup alias slice、game result share helper alias slice、game start logo countdown alias slice、game skip logo transition alias slice、game start game entry alias slice、game auto start game alias slice、game return to start screen alias slice、game open game over character select alias slice、game random food generation helper alias slice、game update stock HUD helper alias slice、game cooldown indicator helper alias slice、game update HUD helper alias slice、game replay snapshot throttle helper alias slice、game auto battle speed menu helper alias slice、game auto battle relay control state alias slice、game game-over relay settlement alias slice、game network helper alias slice、game sandworm status helper alias slice、game turn/direction helper alias slice、game attack stats direction vector helper alias slice、game lobster path nearby cells helper alias slice、game attack visual circle projectile helper alias slice、game Gu King lobster volley helper alias slice、game character big attack scheduler alias slice、game launch attack helper alias slice、game damage vulnerability helper alias slice、game attack stun / slow helper alias slice、game vulnerability collision paralysis helper alias slice、game projectile resolver helper alias slice、game projectile blast visual helper alias slice、game game-over visual advance helper alias slice、game hazard resolver helper alias slice、game owner movement helper alias slice、game replace consumed foods helper alias slice、game step helper alias slice、game step player-only helper alias slice、game step computer-only helper alias slice、game end game helper coverage、game loop helper alias slice、game pointer direction helper alias slice、game control-pad attack pointer helper alias slice、game move stick helper alias slice、game target stick helper alias slice、game opponent target helper alias slice、game keyboard attack direction helper alias slice、game keyboard attack hint helper alias slice、game keyboard aim key helper alias slice 與 module loader smoke stability 已完成，下一步延續 Phase D service module migration。
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
3. LAN 多人剩餘雙機長時間 reconnect / snapshot 驗證；若通過，再規劃 WebRTC DataChannel。
4. 執行 ES module split 下一批：延續 Phase D service module migration，盤點剩餘 direct window/facade reads，挑下一個 low-risk helper 或 import preflight 小切片，production 繼續 `bundled-legacy-fallback`。
5. 若之後要繼續 AI 訓練，先以 dragon / gu_king 為目標重跑完整 target-vs-field gate，不直接套用既有輸出。
6. 最後再做 replay 分享、每日挑戰與觀戰聯賽。
