# Hex Snake Pre-App Optimization Plan

更新日期：2026-05-19

## 1. 目的

本文件整理「擴充 App 版之前」建議先完成的工作。目標不是立刻包 Android / iOS，而是先把 Web 版整理成更適合 App 化的狀態：

- build 輸出穩定。
- 離線與快取可控。
- 素材大小可控。
- 平台差異可隔離。
- 行動操作與效能先在 Web 版驗證。

這些工作完成後，再導入 Capacitor 或其他 App shell 時，風險會低很多。

## 2. 優先順序總覽

建議順序：

```text
Build 正規化
→ PWA / 離線基礎
→ 素材壓縮與資產分層
→ Storage / Platform Adapter
→ 行動操作與效能 QA
→ 測試與發布檢查
→ Capacitor App shell
```

最高優先：

1. 整理 build 流程。
2. 補 PWA 基礎。
3. 壓縮素材。
4. 抽象平台 API。

第二優先：

1. 儲存資料升級。
2. 行動操作打磨。
3. 效能保護。
4. 文字與編碼清理。

第三優先：

1. 測試與驗收流程。
2. App-like 功能雛形。
3. 發布文件與商店素材準備。

## 3. 工作項目

### 3.1 Build 正規化

現況：

- `src/main.js` 目前會 `fetch` 多個 `src/*.js`，組成 Blob 後再 `import()`。
- 這種方式在 Web 可運作，但對 App WebView、CSP、PWA 離線快取、版本更新會比較不穩。

建議：

- 導入正式 bundler，例如 Vite、esbuild 或 Rollup。
- 讓 `dist/` 成為唯一部署輸出。
- JS / CSS / assets 產生可追蹤的 build manifest。
- 避免 App 版依賴 Blob dynamic import。

任務：

- 評估現有 legacy global 依賴。
- 決定 bundle 工具。
- 建立 `build:web`。
- 建立 source map 策略。
- 確認 `npm run build` 後產物可直接被靜態伺服器提供。

驗收標準：

- Web 版可正常啟動。
- 不再需要將多個 `src/*.js` 組成 Blob 後 import。
- `dist/` 檔案清楚、可被 service worker 快取。
- `npm run test:quick` 與 `npm run test:smoke` 通過。

### 3.2 PWA / 離線基礎

現況：

- 已有 favicon 與 apple touch icon。
- 尚未建立完整 PWA manifest 與 service worker。

建議：

- 先讓 Web 版具備可安裝與離線啟動能力。
- App shell 之前先用 PWA 測試快取策略與更新策略。

任務：

- 新增 `manifest.webmanifest`。
- 補齊 192x192、512x512 icons。
- 新增 `service-worker.js`。
- 建立 cache version。
- 建立 offline fallback。
- 建立更新提示 UI。
- 確認 HTTPS / localhost 下 installability。

驗收標準：

- 手機瀏覽器可加入主畫面。
- 離線可開啟首頁與核心遊戲。
- 已快取素材可正常載入。
- 新版本部署後可提示重新啟動套用。

### 3.3 素材壓縮與資產分層

現況：

- 目前 `dist` 約 153.77 MB。
- `dist/assets` 約 152.89 MB。
- 專案完整 `assets/` 約 726 MB。
- 主要體積來自角色圖片與音效。

建議：

- 在 App 化前先降低 Web build 的素材成本。
- 不要等 App 包起來才處理體積問題。

任務：

- PNG 轉 WebP 或 AVIF。
- WAV 轉 AAC / M4A / OGG。
- 確認 full-size、source、backup、debug 素材不進入 `dist`。
- 建立 core assets / character assets / optional assets 分層。
- 依 DPR 與裝置能力載入 `sm` / `md`，避免一律載入大圖。
- 對 loading 畫面使用低解析預覽圖。

驗收標準：

- `dist` 體積低於目前基準。
- 首次可互動時間下降。
- 低階手機載入時不明顯卡頓。
- build manifest 能清楚列出進入部署包的素材。

進度（2026-05-19）：

- 已完成：production build 會將部署用角色 PNG 轉為 WebP，原始 PNG 不進 `dist`。
- 已完成：production build 會將角色 WAV 音效轉為 M4A/AAC，原始 WAV 不進 `dist`。
- 已完成：`dist/data/characters.json` 與角色音效 manifest 會改寫為部署格式路徑。
- 已完成：`check:assets` 會檢查 WebP / M4A 轉檔數量、節省容量與禁止部署 PNG / WAV。
- 結果：`dist` 約 26.64 MB，build manifest 可列出 WebP 圖片與 M4A 音效統計。
- 待後續：若要更細，仍可再做 optional character pack 或按角色延遲下載策略。

### 3.4 Storage Adapter

現況：

- 專案大量使用 `localStorage` 保存設定、戰績與重播相關資料。
- Web 版可接受，但 App 版後續可能需要 Capacitor Preferences、Filesystem 或 IndexedDB。

建議：

- 先建立 storage adapter，不急著一次搬完資料。
- 讓遊戲核心不直接依賴 `localStorage`。

任務：

- 定義 storage API：
  - `get(key)`
  - `set(key, value)`
  - `remove(key)`
  - `getJson(key, fallback)`
  - `setJson(key, value)`
- 建立 Web 實作。
- 預留 App 實作。
- 加入 save data version。
- 加入 migration。
- 加入 corrupted data reset。

驗收標準：

- 主要設定不再直接散落呼叫 `localStorage`。
- 舊資料可正常讀取。
- 資料格式變更時可遷移。
- 壞資料不會讓遊戲啟動失敗。

### 3.5 Platform Adapter

現況：

- 目前大部分功能直接使用 browser API。
- App 版會需要處理震動、背景暫停、返回鍵、分享、版本資訊等平台能力。

建議：

- 先在 Web 版建立空實作或 browser 實作。
- App 化後替換成 Capacitor 實作。

建議介面：

```js
const platform = {
  kind: "web",
  storage: {},
  haptics: {},
  lifecycle: {},
  share: {},
  appInfo: {},
  display: {}
};
```

任務：

- 建立 `src/platform/web.js`。
- 規劃 `src/platform/mobile.js`。
- 將音效 unlock、震動、版本資訊、分享、全螢幕等能力集中管理。
- App 背景化時預留 pause hook。
- 前景恢復時預留 resume hook。

驗收標準：

- 遊戲核心不用知道目前是在 Web 還是 App。
- Web 版功能不受影響。
- 未支援的平台功能有安全 fallback。

### 3.6 行動操作打磨

現況：

- 專案已大量使用 pointer event。
- 已有虛擬搖桿、左手模式、safe-area 相關 CSS。

建議：

- 在 App 化前先以手機瀏覽器測行動操作。
- 先解決 Web 手機版的問題，再包成 App。

任務：

- 測試直向與橫向。
- 決定 App 版預設是否鎖橫向。
- 調整虛擬搖桿位置、大小與透明度。
- 檢查 pointer cancel、長按、滑動、雙指操作。
- 檢查 safe-area 在瀏海手機上的位置。
- 加入控制設定預覽。

驗收標準：

- 手機單手操作可接受。
- 主要按鈕不被瀏海、手勢列或瀏覽器 UI 擋住。
- 長時間操作不誤觸。
- pointer cancel 不會造成卡住或連續攻擊。

### 3.7 效能與電量保護

現況：

- 遊戲使用 canvas 與 `requestAnimationFrame`。
- 高解析手機上若 DPR 過高，可能增加 GPU 與電量負擔。

建議：

- App 化前先建立保護機制。

任務：

- 限制 canvas DPR，例如最高 2。
- 暫停與背景時停止 RAF。
- 新增低特效模式。
- 新增低耗電模式。
- 圖片預解碼分批處理。
- 音效預載分批處理。
- 建立 debug FPS / frame time 顯示。

驗收標準：

- 低階 Android 可穩定遊玩。
- 背景化或暫停時不持續消耗大量資源。
- 高解析手機不因 DPR 過高造成明顯掉幀。
- 效能問題可被量測，不只靠感覺。

進度（2026-05-19）：

- 已完成：canvas DPR 由 platform display adapter 限制，低耗電時會進一步降低上限。
- 已完成：背景化 / pagehide 會透過 lifecycle hook 停止 RAF，回前景後才恢復。
- 已完成：新增低耗電設定，會降低視覺負載並記錄使用者偏好。
- 已完成：新增 FPS / frame time overlay，可從設定面板開啟，供手機 QA 量測。
- 已驗證：build、asset、size、quick、desktop/mobile smoke、offline smoke 與瀏覽器實測通過。

### 3.8 文字與編碼清理

現況：

- 終端輸出曾看到 README / HTML 文字亂碼。
- 可能是 PowerShell 顯示編碼問題，但 App 上架前仍應檢查。

建議：

- 在 App 化前確認所有使用者可見文字都是 UTF-8 且顯示正常。

任務：

- 檢查 `index.html`。
- 檢查 `README.md`。
- 檢查 `data/*.json`。
- 檢查遊戲內 UI 文字。
- 檢查商店預計使用文案。
- 建立 UTF-8 JSON 檢查流程。

驗收標準：

- 遊戲畫面無亂碼。
- 文件無亂碼。
- JSON 可被嚴格 UTF-8 解碼。
- 商店文案可直接使用。

### 3.9 測試與驗收流程

建議：

- 在 App 化前先建立固定檢查，之後 Web 與 App 共用。

任務：

- 固定執行：
  - `npm run build`
  - `npm run test:quick`
  - `npm run test:smoke`
  - `npm run data:check`
- 加入 dist size 檢查。
- 加入 asset manifest 檢查。
- 加入 mobile screenshot 檢查。
- 加入基本離線檢查。

驗收標準：

- 每次 release 前都有固定 checklist。
- dist 變大時能看出原因。
- 缺素材或錯素材能在 build 階段發現。

### 3.10 App-like 功能雛形

建議：

- 這些功能可以先在 Web 版做，之後自然帶進 App。
- 目標是提高留存，也讓 App 版不只是包殼。

候選功能：

- 戰績頁。
- 每日挑戰。
- 角色熟練度。
- 重播收藏。
- 版本資訊。
- 離線狀態提示。
- 對戰結果分享。
- 控制配置檔。

驗收標準：

- Web 版先可用。
- App 版不需要重寫。
- 功能資料經 storage adapter 保存。

## 4. 建議 Milestones

### Milestone A：可被穩定打包的 Web

包含：

- Build 正規化。
- `dist/` 輸出穩定。
- 測試通過。
- 素材 manifest 正常。

完成後收益：

- Web 部署更穩。
- PWA 與 App shell 的基礎更乾淨。

### Milestone B：可安裝的 Web App

包含：

- PWA manifest。
- service worker。
- 離線啟動。
- 更新提示。

完成後收益：

- Web 已具備 App-like 基礎。
- 快取與離線問題先被驗證。

### Milestone C：可控的資產與效能

包含：

- 圖片與音效壓縮。
- 資產分層。
- DPR 上限。
- 低耗電模式。
- FPS / frame time debug。

完成後收益：

- App 首包更小。
- 低階手機更穩。

### Milestone D：平台差異已隔離

包含：

- Storage adapter。
- Platform adapter。
- Lifecycle hook。
- Safe fallback。

完成後收益：

- 導入 Capacitor 時不需要大幅改遊戲核心。
- Web 與 App 後續可同步維護。

## 5. 建議新增 Scripts

可逐步加入，實際內容依實作調整：

```json
{
  "build:web": "node build.js",
  "build:pwa": "node build.js --pwa",
  "check:assets": "node tools/check-assets.js",
  "check:size": "node tools/check-dist-size.js",
  "test:mobile": "node tools/mobile-smoke-test.js",
  "test:offline": "node tools/offline-smoke-test.js"
}
```

若導入 bundler，則可再改成：

```json
{
  "dev": "vite",
  "build:web": "vite build",
  "build:pwa": "vite build --mode pwa",
  "preview": "vite preview"
}
```

## 6. 不建議現在先做的事

暫不建議：

- 立刻重寫成原生 Android / iOS。
- 立刻拆成另一個 repo。
- 立刻加入內購、廣告、推播。
- 還沒處理 build 與素材前就送商店。
- 在 Web 與 App 各維護一份 UI 或遊戲邏輯。

原因：

- 目前最大價值是保留 Web-first 工作流。
- App 版初期主要是部署與平台適配，不是另一套遊戲。
- 過早拆分會提高同步成本。

## 7. 完成前置工作後的下一步

當以下條件完成，就可以進入 App shell 階段：

- `dist/` build 穩定。
- PWA 可安裝與離線啟動。
- 素材體積已下降或有明確分層策略。
- storage / platform adapter 已建立。
- 手機 Web 操作可接受。
- 測試與驗收流程固定。

下一份工作可接續 `app-deployment-plan.md`，開始導入 Capacitor、Android、iOS 與商店上架流程。
