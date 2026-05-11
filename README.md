# Hex Snake

Hex Snake 是一款以六角格為核心的貪食蛇對戰遊戲。專案目前採用單頁 `HTML/CSS/JavaScript` 實作，搭配本機靜態伺服器、角色資料、平衡參數、AI 模擬與調校工具。

遊戲支援玩家對電腦的即時對戰、虛擬搖桿與 `AWEFXZ` 六方向鍵盤操作、角色選擇、頭像與音效資源、GM 除錯設定，以及用於驗證平衡性的自動模擬流程。

## 快速開始

需求：

- Node.js 18 或更新版本
- npm

安裝依賴：

```bash
npm install
```

啟動開發伺服器：

```bash
npm run dev
```

預設位址：

```text
http://localhost:6287
```

指定連接埠：

```bash
PORT=3000 npm run dev
```

Windows PowerShell：

```powershell
$env:PORT=3000; npm run dev
```

## 建置與預覽

產生 `dist/`：

```bash
npm run build
```

建置預設會檢查 `dist/` 是否小於等於 200 MB；若確認 artifact 成長是刻意的，可用環境變數調整：

```powershell
$env:HEX_SNAKE_DIST_BUDGET_MB=250; npm run build
```

從 `dist/` 啟動靜態伺服器：

```bash
npm start
```

建置腳本會複製：

- `index.html`
- `assets/`
- `data/`

## 操作方式

- 移動：使用畫面上的六方向虛擬搖桿，或使用 `AWEFXZ` 鍵盤方向操作。
- HP：上限依 `(蛇長 + 1) * 10` 計算。
- 技能：小招消耗 1 枚炸彈與目前最高食物庫存 2 點；大招依照目前食物庫存與彈藥狀態判斷是否可用。
- 設定：遊戲內可調整開局參數、角色、電腦難度、GM 模式與自動操作選項。
- 自動對戰：可讓玩家或電腦進入自動操作，用於觀察 AI 表現與平衡狀態。

遊戲偏好和部分設定會儲存在瀏覽器 `localStorage`。

## 專案結構

```text
.
├── assets/                 # 頭像、圖片、角色音效等遊戲資源
├── data/
│   ├── balance.json        # 棋盤、速度、攻擊、食物、資源等平衡參數
│   ├── characters.json     # 角色 ID、外觀、頭像、技能與偏好資料
│   └── high-ai-strategies.json
├── doc/                    # 角色、音效、後續任務等設計文件
├── reports/                # 模擬、調校、評估輸出
├── skills/                 # Codex 工作流程輔助資料
├── tools/                  # 測試、模擬、AI 策略、調校和資源產生腳本
├── build.js                # 建置腳本
├── index.html              # 遊戲主體
├── package.json
└── server.js               # 本機靜態伺服器
```

## 常用指令

```bash
npm run dev                  # 啟動開發伺服器
npm run build                # 建置 dist/
npm start                    # 從 dist/ 啟動伺服器
npm test                     # 執行完整測試
npm run test:quick           # 執行快速測試
npm run test:smoke           # 執行瀏覽器 smoke test
npm run audit:globals        # 產生 legacy global 依賴盤點
npm run simulate             # 執行平衡模擬
npm run simulate:run         # 執行排程模擬任務
npm run simulate:jobs        # 檢視模擬任務列表
npm run simulate:scheduled   # 啟動模擬排程器
npm run simulate:ai-cross    # 執行 AI 交叉對戰
npm run tune:balance         # 調整平衡參數
npm run tune:lobster-palm-draw # 調整智蝦追蹤拳對局參數
npm run tune:ai-strategy     # 調整 AI 策略
npm run optimize:strategy    # 執行策略最佳化
npm run evaluate:basic-gate  # 評估基礎 AI 門檻
npm run reset:high-ai-basic  # 重設高階 AI 基礎策略
npm run apply:ai-strategy    # 套用 AI 策略
npm run reports:dashboard    # 產生策略與模擬報表 dashboard
npm run reports:dashboard:serve # 啟動報表 dashboard server
npm run generate:sfx         # 產生角色音效
npm run characters:show      # 在 Windows PowerShell 正確讀取角色 JSON
npm run data:check           # 檢查 data/ 與 dist/data/ 的 UTF-8 JSON
```

## 遊戲與資料設定

主要資料都放在 `data/`：

- `data/balance.json`：預設棋盤大小、食物數量、初始速度、初始長度、資源上限、招式成本、移動速度、攻擊範圍、冷卻、暈眩、角色大招倍率等。
- `data/characters.json`：角色 ID、代表色、頭像路徑、角色故事、招式文字、顏色設定與食物偏好。
- `data/high-ai-strategies.json`：高階 AI 策略資料。

修改資料後建議先跑快速測試：

```bash
npm run data:check
npm run test:quick
```

Windows PowerShell 5.x 的預設 code page 可能會把無 BOM 的 UTF-8 誤判成系統碼頁，導致 `Get-Content data/characters.json` 看起來像亂碼。檔案仍應維持 UTF-8 without BOM，以免 Node 腳本直接 `JSON.parse` 時遇到 BOM；讀取角色資料請用：

```powershell
npm run characters:show
```

如果改動影響戰鬥規則、AI 或平衡參數，再補跑：

```bash
npm test
npm run simulate
```

## 開發備註

- `index.html` 是目前主要遊戲入口，包含介面、狀態管理、輸入、戰鬥流程與資源載入邏輯。
- `server.js` 是輕量靜態伺服器，預設監聽 `0.0.0.0:6287`，可透過 `PORT` 和 `HOST` 環境變數調整。
- `build.js` 只負責複製前端入口、資源與資料到 `dist/`。
- `tools/sim-core.js` 提供模擬核心，多個測試、評估、調校腳本會共用它。
- 遊戲設定、GM 選項與部分偏好會使用瀏覽器 `localStorage` 儲存。

## 相關文件

- `doc/follow-up-execution-list.md`：後續開發與驗證事項
- `doc/legacy-global-dependencies.md`：legacy eval 載入順序與跨檔 global 依賴盤點
- `doc/strategy-optimization-sop.md`：AI 策略最佳化、target-vs-baseline 驗證與套用流程
- `doc/character-move-details.md`：角色招式與技能細節
- `doc/character-voice-design.md`：角色語音與音效設計
- `doc/chibi-portrait-effect-prompts.md`：Q 版頭像效果提示詞
