# Hex Snake

## 1) 專案標題與簡介 (Title & Description)

`Hex Snake` 是一個在 HTML/CSS/JavaScript 打底下的網頁遊戲專案，核心玩法是「**六角格蜂巢棋盤**」上的蛇對戰。

遊戲支援：

- 角色選擇、角色對話/立繪資產動態載入
- 人機對戰（P1 vs P2）
- 進階控制設定（方向鍵綁定、特殊技能按鍵、左手模式）
- 食物／資源系統、攻擊蓄力與冷卻機制、生命值與回合統計
- 回放系統、重播封存、設定與戰績快取（`localStorage`）
- LAN / Wi-Fi 房間連線、Host / Guest 對戰與本機 WebSocket relay
- AI 策略資料與模擬調參工作流（`tools/`）

前端入口為 `index.html`，遊戲初始化於 `src/main.js`，並透過載入器動態注入 `src/` 目錄中的模組化腳本（`state`, `dom`, `ui`, `characters`, `audio`, `replay`, `ai`, `render`, `game`）。

專案進度、發布控管與下一步統一維護於 [`doc/project-management.md`](doc/project-management.md)。

## 2) 核心功能特性 (Features)

### 遊戲體驗

- 六角格地圖的蛇行進與食物收集
- P1/P2 狀態列（生命條、加速倍率、勝利指標、最佳紀錄）
- 小技/大技與攻擊冷卻提示
- 角色能力、勝負台詞、立繪切換流程

### 角色與資源系統

- `data/characters.json` 定義角色（名稱、外觀、技能、故事與結果台詞）
- `data/balance.json` 定義難度參數、速度、食物、傷害、攻擊與生命回補邏輯
- 遊戲啟動/重開時會套用預設角色與平衡參數

### AI 與模擬工具

- `tools/` 提供策略優化、模擬、對戰、回放與 QA 的腳本
- 支援快速測試：`npm run test:quick`、`npm run test:smoke`
- 支援完整模擬與策略實驗：`npm run simulate`、`npm run optimize:strategy`、`npm run simulate:ai-cross`、`npm run evaluate:strategy-gate`

### 建置與部署

- `npm run build` 會將執行期資源複製至 `dist/`
- 打包過程會：
  - 僅納入執行期需要的 `src/data/assets` 資源
  - 產生 `dist/build-asset-manifest.json`
  - 可透過 `HEX_SNAKE_DIST_BUDGET_MB` 控制 `dist/` 大小上限
- `.github/workflows/deploy.yml` 提供 GitHub Pages 部署流程

## 3) 系統需求與安裝步驟 (Prerequisites & Installation)

### 系統需求

- Node.js 18+（建議 20）
- npm
- PowerShell（Windows）或 Bash（Linux/macOS）

### 安裝步驟

```powershell
cd C:\Users\user\Documents\app\hex_snake
npm install
```

```bash
cd /path/to/hex_snake
npm install
```

> 使用既有 `package-lock.json` 的環境可改用 `npm ci`（更貼近 CI 行為）。

## 4) 快速上手與使用範例 (Quick Start / Usage)

### 開發模式（立即啟動）

```bash
npm run dev
```

- 預設網址：`http://localhost:6287`
- 預設主機：`0.0.0.0`
- 可指定埠號：

```bash
PORT=3000 npm run dev
```

```powershell
$env:PORT=3000
npm run dev
```

### 本機打包與測試靜態版

```bash
npm run build
npm start
```

`npm start` 會以 `dist/` 作為靜態根目錄（`--dist`）。

### Android App 建置與簽章

```bash
npm run android:build:debug
npm run android:bundle:release
```

- debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`
- release AAB：`android/app/build/outputs/bundle/release/app-release.aab`

正式上傳 Google Play 前，需提供 Android upload keystore。可複製 `android/signing.properties.example` 為 `android/signing.properties`，或在 CI 設定下列環境變數：

```text
HEX_SNAKE_ANDROID_KEYSTORE_FILE
HEX_SNAKE_ANDROID_KEYSTORE_PASSWORD
HEX_SNAKE_ANDROID_KEY_ALIAS
HEX_SNAKE_ANDROID_KEY_PASSWORD
```

`android/signing.properties` 與 keystore 檔案已被 `.gitignore` 排除。需要強制檢查簽章資料時執行：

```bash
npm run android:bundle:signed
```

### 常用指令

```bash
npm run test
npm run test:quick
npm run test:network
npm run test:smoke
npm run simulate
npm run simulate:run
npm run simulate:jobs
npm run simulate:scheduled
npm run tune:balance
npm run tune:ai-strategy
npm run optimize:strategy
npm run reports:dashboard
npm run reports:dashboard:serve
```

### 建議遊玩流程（快速）

1. 執行 `npm run dev`
2. 開啟 `http://localhost:6287`
3. 點擊 `Start` 開局
4. 進入設定可調整：
   - 難度
   - 角色
   - 按鍵綁定與控制模式

## 5) 專案架構說明 (Project Structure)

```text
.
├─ index.html              # 遊戲頁面、DOM 結構、載入器入口
├─ server.js               # 本機靜態伺服器（支援 --dist、PORT、HOST）
├─ build.js                # 建置腳本（輸出 dist/、資源清單與大小檢查）
├─ package.json            # Scripts / 套件依賴定義
├─ package-lock.json
├─ dist/                   # 打包輸出（可選，通常由 CI/發佈使用）
├─ src/                    # 遊戲核心邏輯
│  ├─ main.js              # 載入進度、載入各模組腳本
│  ├─ game.js              # 遊戲核心規則與回合流程
│  ├─ state.js             # 遊戲狀態模型
│  ├─ render.js            # 畫面與動畫繪製
│  ├─ ui.js                # 畫面控制、HUD 與操作介面
│  ├─ dom.js               # DOM 互動綁定
│  ├─ characters.js        # 角色資料與選擇流程
│  ├─ audio.js             # 音效載入與播放控制
│  ├─ ai.js                # AI 決策邏輯
│  ├─ replay.js            # 回放紀錄與回放匯入/重播
├─ data/                   # 遊戲資料（JSON）
│  ├─ characters.json
│  ├─ balance.json
│  ├─ high-ai-strategies.json
│  └─ extreme-ai-strategies.json
├─ assets/                 # 視覺素材與音訊
│  ├─ logos/
│  ├─ portraits/
│  ├─ audio/
│  └─ screenshots/
├─ tools/                  # AI 調參、模擬、回歸測試工具
│  ├─ sim-core.js
│  ├─ simulate-balance.js
│  ├─ run-tests.js
│  ├─ run-strategy-optimization.js
│  ├─ tune-*.js
│  └─ ...
├─ doc/                    # 專案操作與策略文件
│  ├─ project-management.md # 專案進度與發布主控入口
│  ├─ follow-up-execution-list.md
│  ├─ legacy-global-dependencies.md
│  ├─ strategy-optimization-sop.md
│  └─ ...
├─ reports/                # 模擬/訓練結果輸出與歷程快照
├─ .github/
│  └─ workflows/
│     └─ deploy.yml       # GitHub Pages CI/CD
└─ README.md
```

## 6) 授權條款 (License)

本專案採用 **Apache License 2.0**。  
授權重點（簡版）：

- 可自由使用、修改、發佈及商用
- 需保留原始版權與授權聲明
- 修改後須註明變更
- 若有修改並分發衍生作品，需包含相同授權

完整條文請參考官方版本：<https://www.apache.org/licenses/LICENSE-2.0>  
建議在專案根目錄新增 `LICENSE` 檔，並放入 Apache 2.0 全文以完整對外釋出。
