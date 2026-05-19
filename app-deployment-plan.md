# Hex Snake App 部署計畫書

更新日期：2026-05-19

## 1. 目標

將目前的 Hex Snake Web 遊戲擴充為可安裝、可離線、可上架的 App 版本，同時維持 Web 版與 App 版共用同一套遊戲核心、角色資料、平衡參數與素材流程，避免後續維護分裂。

短期目標：

- 建立 PWA 基礎，讓 Web 版具備安裝與離線啟動能力。
- 使用 Capacitor 將既有 Web build 包成 Android / iOS App。
- 先完成可測機版本，再處理商店上架細節。

中期目標：

- 壓縮首包體積與改善低階手機效能。
- 加入 App 專屬體驗，例如返回鍵、背景暫停、震動回饋、方向鎖定。
- 建立 Web 與 App 共用的發布流程。

長期目標：

- 支援穩定的離線資料、戰績、重播與版本遷移。
- 視產品方向擴充角色熟練度、雲端同步、商店功能或平台服務。

## 2. 目前專案現況

目前專案是單頁 Web 遊戲，核心檔案包含：

- `index.html`
- `src/main.js`
- `src/game.js`
- `src/render.js`
- `src/ui.js`
- `src/audio.js`
- `data/*.json`
- `assets/`

既有流程：

- `npm run dev`：啟動本機開發伺服器。
- `npm run build`：輸出 `dist/`。
- `npm start`：以 `dist/` 啟動靜態伺服器。
- `npm run test` / `npm run test:quick` / `npm run test:smoke`：測試與煙霧檢查。
- `npm run app:check`：檢查 App shell 前置條件，包含 PWA、service worker、bundle entry、版本資訊與部署素材。
- `npm run release:check`：依序執行 build、文字、資料、素材、體積、遊戲邏輯、手機、煙霧、離線與 App readiness 檢查。

目前 `dist/build-asset-manifest.json` 顯示：

- `dist` 約 26.71 MB。
- `assets` 約 26.43 MB。
- runtime files 214 個，其中 runtime assets 205 個。
- 角色圖片為 120 個 WebP。
- 角色音效為 72 個 M4A。
- 目前 build budget 為 200 MB，尚未超出。

主要觀察：

- 專案已具備行動 viewport、pointer/touch 控制、虛擬搖桿與 safe-area CSS。
- 已具備 PWA manifest、service worker、offline fallback 與更新提示，並由 `test:offline` 與 `app:check` 驗證。
- production `dist/index.html` 載入單一 `assets/app.bundle.js`，不再依賴 `src/main.js` 的 Blob dynamic import。
- 素材已完成部署格式壓縮，圖片與音效仍是後續 App 首包與分包策略的主要觀察點。

## 3. 建議技術路線

建議採用「PWA 先行，Capacitor 包裝」。

### 3.1 第一階段：PWA

PWA 是 Web 與 App 之間的橋。先完成 PWA 可以讓 Web 版也受益：

- 可加入主畫面。
- 可離線啟動。
- 可使用 service worker 管理快取。
- 可建立版本更新策略。
- 可先在瀏覽器驗證行動體驗，再進入原生包裝。

需要新增：

- 已完成：`manifest.webmanifest`、192x192 / 512x512 icons、`service-worker.js`、offline fallback 與更新提示。
- 已驗證：`test:offline` 會檢查離線 shell 與 service worker 基礎；`app:check` 會檢查 dist PWA manifest、SW precache、bundle entry、版本注入與部署素材。
- 待後續：以實機 Chrome / Safari 驗證加入主畫面、圖示、啟動畫面與更新提示體驗。

### 3.2 第二階段：Capacitor App

Capacitor 適合這個專案，因為它能把現有 Web 專案包成 iOS / Android App，同時保留 Web-first 開發流程。

需要新增：

- `capacitor.config.*`
- `android/`
- `ios/`
- App icon / splash assets。
- Android package id。
- iOS bundle id。
- App lifecycle adapter。
- Native platform adapter。

建議先不做 full native rewrite。除非後續要大量使用原生遊戲引擎、複雜商業化 SDK、重度多人連線或高效能圖形需求，否則目前 Web + Capacitor 的成本效益最高。

## 4. 專案管理方式

建議維持同一 repo，不拆成另一個專案。

理由：

- 遊戲邏輯、角色資料、AI、平衡參數與素材高度共用。
- Web 與 App 若拆 repo，後續 bugfix、平衡調整與素材更新容易漏同步。
- 目前 App 版主要是部署與平台適配，不是另一套產品。

建議整理成以下結構：

```text
hex_snake/
  index.html
  build.js
  package.json
  src/
    core/
    render/
    ui/
    platform/
      web.js
      mobile.js
  data/
  assets/
  public/
    manifest.webmanifest
    service-worker.js
  capacitor.config.ts
  android/
  ios/
  tools/
  doc/
```

短期可以不立刻大搬家，但應逐步把平台差異收斂到 `src/platform/` 類似的 adapter。

## 5. App 版可做的擴充與優化

### 5.1 離線與快取

建議事項：

- 首次載入核心檔案與必要資產。
- 角色圖片、語音、特殊素材可分批快取。
- service worker 使用版本化 cache name。
- 更新時採「下載完成後提示重啟」策略，避免遊戲中途混用新舊資產。
- App 版啟動時檢查資產版本，必要時清除舊快取。

### 5.2 素材體積

目前 `dist` 約 26.71 MB，已低於 200 MB build budget；App 首包仍應持續盡量壓小，並保留後續分包空間。

建議事項：

- 已完成：production build 會將角色圖片轉為 WebP，角色音效轉為 M4A/AAC，原始 PNG / WAV 不進入 `dist`。
- 已完成：`check:assets` 與 `app:check` 會檢查部署素材格式、manifest、budget 與 forbidden assets。
- full-size 原始圖不要進入 App 首包。
- 依裝置 DPR 載入 `sm` / `md`，不要一律載入大圖。
- 將角色素材分為：
  - core pack：啟動與預設角色需要的素材。
  - character pack：選到角色或進入角色頁時才載入。
  - optional pack：展示、圖鑑或高解析素材。

### 5.3 行動操作

建議事項：

- 提供橫向鎖定，或至少針對直向做專門布局。
- Android 返回鍵：
  - 設定面板開啟時返回關閉面板。
  - 遊戲中返回先暫停。
  - 暫停狀態再返回才離開或跳出確認。
- App 背景化時自動暫停。
- 回到前景時恢復畫面並重新檢查音訊狀態。
- 虛擬搖桿支援大小、位置、透明度與左手/右手模式。
- 加入震動回饋：
  - 攻擊命中。
  - 受到傷害。
  - 冷卻完成。
  - 勝利或失敗。

### 5.4 效能與電量

建議事項：

- 限制 canvas devicePixelRatio，例如最高 2。
- 提供低耗電模式。
- 提供低特效模式。
- 背景或暫停時停止 `requestAnimationFrame`。
- 減少非必要的圖片同時解碼。
- 避免一次預載所有角色全尺寸素材。
- 加入基本效能監測：
  - FPS。
  - frame time。
  - asset load time。
  - 首次可互動時間。

### 5.5 儲存與資料遷移

目前大量使用 `localStorage`。短期可以維持，但建議抽象成 storage adapter。

建議分層：

- Web：
  - 設定與小資料：`localStorage`。
  - 重播與較大資料：IndexedDB。
- App：
  - 設定與小資料：Capacitor Preferences。
  - 重播與較大資料：IndexedDB 或 Capacitor Filesystem。

需要加入：

- save data version。
- migration function。
- reset corrupted data 流程。
- 匯出 / 匯入重播或設定的可能性。

### 5.6 App-like 功能

為了讓 App 版不只是網站包殼，建議逐步加入：

- 本機戰績統計。
- 角色熟練度。
- 重播收藏。
- 點擊結果文字複製對戰結果。
- 設定配置檔。
- 震動與音效設定。
- App 專屬設定頁。
- 離線模式標示。
- 版本資訊與更新紀錄。

這些功能可以提高 App Store 審核時的產品完整度，也能提高留存。

## 6. Web 與 App 同步維護策略

核心原則：同一套核心，多個平台殼。

### 6.1 共用部分

以下內容應維持共用：

- 遊戲規則。
- AI。
- 角色資料。
- 平衡參數。
- Canvas render。
- 音效播放邏輯的高層 API。
- 重播資料格式。
- 測試工具。
- 素材 manifest。

### 6.2 平台差異

以下內容應透過 adapter 分開：

- 儲存 API。
- 震動。
- 狀態列與 safe area。
- Android 返回鍵。
- App lifecycle。
- 檔案系統。
- 分享功能。
- 商店評分。
- 推播。
- 內購或廣告。

建議建立類似介面：

```js
const platform = {
  kind: "web",
  storage: {},
  haptics: {},
  lifecycle: {},
  share: {},
  appInfo: {}
};
```

Web 與 App 只替換平台實作，不改遊戲核心。

### 6.3 Build scripts

建議新增 scripts：

```json
{
  "build:web": "node build.js",
  "build:pwa": "node build.js --pwa",
  "build:mobile": "node build.js --mobile",
  "app:check": "node tools/check-app-readiness.js",
  "cap:sync": "npx cap sync",
  "cap:android": "npx cap open android",
  "cap:ios": "npx cap open ios"
}
```

實際指令可依導入 Capacitor 後調整。

### 6.4 發布節奏

建議流程：

1. 先合併到 Web 版。
2. Web 版部署後觀察 1 到 3 天。
3. 若沒有嚴重問題，建立 App release candidate。
4. Android 進 internal testing。
5. iOS 進 TestFlight。
6. 收斂問題後送正式商店。

Web 適合作為快速驗證場，App 適合作為穩定發布版。

### 6.5 版本號

建議使用一致版本號：

- Web：`1.2.0`
- Android：`versionName 1.2.0`，`versionCode` 遞增。
- iOS：`CFBundleShortVersionString 1.2.0`，`CFBundleVersion` 遞增。

若只有 App shell 修正，可使用：

- Web core：`1.2.0`
- App shell：`1.2.0+android.3` 或內部 build number 表示。

## 7. 階段計畫

### Phase 0：整理與基準測試

目標：確認目前 Web build 可穩定作為 App 基底。

任務：

- 跑 `npm run release:check`。
- 記錄 dist 大小。
- 記錄桌機與手機瀏覽器 FPS。
- 檢查 UTF-8 文字是否有亂碼。
- 確認 `dist/` 不含 source、backup、debug 素材。
- 確認 `app:check` 通過，避免 App shell 導入前 PWA、SW、bundle 或版本資訊退化。

完成標準：

- Web build 成功。
- smoke test 成功。
- dist asset manifest 無 missing / forbidden。
- 文字顯示正常。
- App readiness 檢查通過。

進度（2026-05-19）：

- 已完成：`release:check` 目前涵蓋 build、text、data、assets、size、quick、mobile、desktop/mobile smoke、offline 與 `app:check`。
- 已完成：`app:check` 會驗證 PWA manifest、service worker precache、dist bundle entry、app version / build version、build manifest 與最佳化素材。
- 已驗證：`npm run release:check` 全流程通過，`dist` 約 26.71 MB。

### Phase 1：Build 正規化

目標：降低 App WebView 與離線快取的不確定性。

任務：

- 已完成：production build 輸出單一 `assets/app.bundle.js`，`dist/index.html` 不再載入 `src/main.js`。
- 待後續：評估是否導入 Vite / esbuild / Rollup。
- 產出 hash 檔名或版本化 manifest。
- 讓 `dist/` 成為唯一部署輸出來源。

完成標準：

- Web 啟動不依賴動態組 Blob。
- build output 可被 service worker 穩定快取。
- 測試指令通過。

進度（2026-05-19）：

- 已完成：部署版已由 build script 產生 bundle、source map 與 build manifest，並由 `app:check` 驗證 dist entry 不回退到 source modules。

### Phase 2：PWA

目標：讓 Web 版可安裝、可離線啟動。

任務：

- 已完成：新增 `manifest.webmanifest`。
- 已完成：新增 PWA icons。
- 已完成：新增 service worker。
- 已完成：建立 cache strategy。
- 已完成：加入離線 fallback。
- 已完成：加入更新提示。
- 以手機 Chrome / Safari 測試加入主畫面。

完成標準：

- PWA 可安裝。
- 離線可開啟。
- 已快取資產可正常進入遊戲。
- 新版本部署後能提示更新。

進度（2026-05-19）：

- 已完成：`test:offline` 驗證離線 shell 與 service worker 基礎，`app:check` 驗證 dist manifest、icons、service worker placeholder 已替換與核心 precache。

### Phase 3：Capacitor Shell

目標：建立 Android / iOS 可測機版本。

任務：

- 安裝 Capacitor。
- 新增 `capacitor.config.*`。
- 設定 `webDir` 指向 `dist`。
- 新增 Android / iOS 專案。
- 設定 app id、app name、icon、splash。
- 實作 App lifecycle 暫停 / 恢復。
- 實作 Android 返回鍵。
- 實作基本 haptics。

完成標準：

- Android 可安裝測機。
- iOS 可透過 Xcode / TestFlight 測試。
- Web 與 App 使用同一份 `dist`。
- App 背景化與恢復不破壞遊戲狀態。

進度（2026-05-19）：

- 已完成：安裝 Capacitor 8，新增 `capacitor.config.json`，`webDir` 指向 `dist`，app id 為 `com.whitedragon.hexsnake`。
- 已完成：新增 `build:mobile`、`cap:copy`、`cap:sync`、`cap:android`、`cap:ios` scripts；mobile build 會以 `src/platform/mobile.js` 包裝同一套遊戲核心。
- 已完成：新增 Android 與 iOS 原生專案，Android / iOS 版本號與 `package.json` 的 `1.0.0` 對齊。
- 已完成：實作 mobile platform adapter，支援 Capacitor App lifecycle、Android 返回鍵與 Haptics，並保留原手機 web 版的觸控、搖桿與攻擊操作邏輯。
- 已完成：新增 `test:mobile-platform`，以 mock Capacitor bridge 驗證 App lifecycle、Android 返回鍵、Haptics 與 Preferences mirror。
- 已完成：新增 `android:build:debug`、`android:bundle:debug`、`android:bundle:release` 與 `tools/build-android-artifact.js`，自動選用 Android Studio JBR / SDK、寫入 `android/local.properties` 並產出 APK / AAB。
- 已驗證：`npm run build:mobile`、`npm run app:check`、`npm run test:quick`、`npm run test:mobile`、`npm run test:mobile-platform`、`npm run test:offline` 通過。
- 已驗證：Android debug APK 建置成功，產物為 `android/app/build/outputs/apk/debug/app-debug.apk`。
- 待後續：在 Android 實機確認返回鍵、背景恢復、震動與音效 unlock；在 macOS/Xcode 環境執行 iOS build 與 TestFlight 測試。

### Phase 4：資產與效能優化

目標：降低下載體積、載入時間與低階手機負擔。

任務：

- 建立圖片轉檔流程。
- 建立音效轉檔流程。
- 拆分 core assets / optional assets。
- 設定 canvas DPR 上限。
- 加入低耗電模式。
- 加入簡單效能監測。

完成標準：

- App 首包體積下降。
- 首次可互動時間下降。
- 低階 Android 可穩定遊玩。
- 長時間遊玩不明顯過熱或嚴重掉幀。

進度（2026-05-19）：

- 已完成：mobile storage adapter 保留既有同步 localStorage / memory API，同時在 Capacitor App 內 mirror 到 Preferences，避免破壞手機 web 版既有操作流程。
- 已驗證：`test:mobile-platform` 覆蓋 storage JSON round-trip、損毀資料回復 fallback、remove 與 Preferences set/remove mirror。

### Phase 5：上架準備

目標：達到商店送審基本條件。

任務：

- 製作 App Store / Google Play 截圖。
- 準備商店描述。
- 準備隱私政策。
- 確認素材授權。
- 設定內容分級。
- 設定 Android signing。
- 設定 iOS signing。
- 建立 release checklist。

完成標準：

- Android internal testing 可發布。
- iOS TestFlight 可發布。
- 上架資料完整。
- 無明顯 placeholder、測試文字或亂碼。

進度（2026-05-19）：

- 已完成：建立 Android release AAB 本地產出流程，`android:bundle:release` 可在 Capacitor sync 後執行 Gradle `bundleRelease`。
- 已完成：新增 `store/listing-draft.md`、`store/privacy-policy-draft.md`、`store/release-checklist.md`，先整理商店描述、隱私政策草稿、截圖資產與待辦。
- 已完成：新增 `store:check` / `tools/check-store-readiness.js`，檢查商店草稿文件與本地截圖資產。
- 已完成：`app:check` 會檢查 Android artifact scripts、`store:check` 與 `tools/build-android-artifact.js`，避免 release bundle 與商店檢查流程遺漏。
- 已驗證：`android:bundle:debug` 產出 `android/app/build/outputs/bundle/debug/app-debug.aab`，`android:bundle:release` 產出 `android/app/build/outputs/bundle/release/app-release.aab`。
- 已驗證：`store:check` 通過，目前仍有 16 個上架前 checklist 項目需要實機、簽章或商店後台環境完成。
- 待後續：設定正式 Android signing keystore / Play App Signing、建立 Google Play internal testing 版本；iOS signing 與 TestFlight 仍需 macOS / Xcode 環境。

## 8. 主要風險與對策

### 8.1 App 體積過大

風險：

- 影響下載率。
- 低儲存空間裝置容易放棄安裝。
- Google Play 對大型 App 會有下載提醒與限制。

對策：

- 壓縮圖片與音效。
- 不把 full-size source assets 放進 App。
- 採分批下載與 lazy loading。
- Android 若變成大型素材遊戲，可評估 Play Asset Delivery。

### 8.2 iOS / Android WebView 差異

風險：

- 音效 unlock 行為不同。
- pointer capture 行為不同。
- canvas 效能不同。
- 背景恢復後音訊或 RAF 狀態異常。

對策：

- 建立實機測試矩陣。
- 把 platform behavior 收斂到 adapter。
- 背景恢復後重新檢查音訊、RAF、快取與畫布尺寸。

### 8.3 PWA 快取混版

風險：

- HTML 是新版，但 JS / 圖片仍是舊版。
- 玩家看到錯誤畫面或載入失敗。

對策：

- 使用版本化 cache。
- build manifest 記錄所有資產。
- 更新採「下載完成後提示重啟」。
- 啟動時檢查 app version。

### 8.4 Web 與 App 分支維護成本上升

風險：

- App 修一份，Web 忘記修。
- 平衡參數不同步。
- 素材 manifest 不一致。

對策：

- 同一 repo。
- 同一核心。
- 同一資料來源。
- 平台差異只放 adapter。
- CI 同時跑 web 與 mobile build 檢查。

### 8.5 商店審核問題

風險：

- Apple 認為只是網站包殼。
- 隱私政策或素材授權不足。
- 送審 build 有 placeholder 或測試內容。

對策：

- 加入 App 專屬功能：離線、震動、返回鍵、戰績、重播、設定配置檔與版本資訊。
- 清楚提供隱私政策。
- 確認全部素材可商用。
- 送審前跑完整 checklist。

## 9. 驗收清單

### Web / PWA

- `npm run build` 成功。
- `npm run test:quick` 成功。
- `npm run test:smoke` 成功。
- PWA 可安裝。
- 離線可啟動。
- 新版本可提示更新。
- 手機 Chrome / Safari 可正常遊玩。

### Android

- Debug build 可安裝。
- Release build 可簽章。
- 返回鍵行為正確。
- 背景暫停與恢復正確。
- 音效正常。
- 震動正常。
- 低階 Android 可接受。

### iOS

- Xcode build 成功。
- TestFlight build 成功。
- 安全區與瀏海顯示正常。
- 背景暫停與恢復正確。
- 音效 unlock 正常。
- 觸控操作正常。

### 上架

- App icon 完整。
- Splash / launch screen 完整。
- 截圖完整。
- 描述完整。
- 隱私政策完整。
- 內容分級完成。
- 素材授權確認。
- 無亂碼、placeholder、debug UI。

## 10. 建議優先順序

最高優先：

1. 建立 Capacitor shell。
2. 實機測試 Android / iOS。
3. 補 Android 返回鍵、震動與 App lifecycle。
4. 驗證 PWA 安裝、離線與更新提示在實機瀏覽器的體驗。
5. 評估是否導入正式 bundler 與更細的資產分包。

第二優先：

1. storage adapter。
2. App lifecycle adapter。
3. Android 返回鍵。
4. haptics。
5. 低耗電模式。

第三優先：

1. 角色熟練度。
2. 重播分享。
3. 雲端同步。
4. 商業化功能。

## 11. 參考資料

- Capacitor 官方文件：https://capacitorjs.com/docs/
- MDN PWA installability：https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Apple App Review Guidelines：https://developer.apple.com/app-store/review/guidelines/
- Google Play App Size Limits：https://support.google.com/googleplay/android-developer/answer/9859372
- Android App Bundle / Play Asset Delivery：https://developer.android.com/guide/app-bundle
