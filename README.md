# Hex Snake

六角貪食蛇對戰是一款單頁瀏覽器遊戲：玩家與 AI 在六角格棋盤上移動、搶食物、累積資源，並用角色技能擊敗對手。專案以原生 HTML/CSS/JavaScript 為主，遊戲資料與平衡參數放在 `data/`，模擬與調校工具放在 `tools/`。

## 功能概覽

- 六角格貪食蛇對戰，支援玩家對 AI、AI 自動對弈與重播控制。
- 角色系統：每個角色有偏好食物、代表色、肖像資源、小招與大招。
- 資源與技能：食物會提供能量與不同屬性庫存，庫存影響攻擊範圍、傷害、速度與控制效果。
- 開局與 GM 設定：可調整棋盤、食物數、初始速度、初始長度、能量、炸彈與庫存。
- 平衡模擬：內建批次對戰、排程模擬、AI 策略調校與回歸測試工具。

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

預設會在以下網址提供遊戲：

```text
http://localhost:6287
```

如需指定埠號：

```bash
PORT=3000 npm run dev
```

Windows PowerShell 可使用：

```powershell
$env:PORT=3000; npm run dev
```

## 建置與執行

產生 `dist/`：

```bash
npm run build
```

從 `dist/` 執行：

```bash
npm start
```

`build.js` 目前會複製：

- `index.html`
- `assets/`
- `data/`

## 操作方式

- 移動：使用畫面上的六方向控制盤，或鍵盤方向控制。
- 技能：小招與大招會依目前資源、能量與炸彈數量決定是否可用。
- 設定：右上角可打開開局設定、規則與 GM 設定。
- 自動對弈：可切換玩家/電腦自動操作，並調整自動對弈速度。

實際按鍵綁定可在遊戲內設定，偏好會儲存在瀏覽器 `localStorage`。

## 專案結構

```text
.
├── assets/                 # 角色肖像、頭像與圖像資源
├── data/
│   ├── balance.json        # 遊戲平衡、初始值、資源與攻擊參數
│   ├── characters.json     # 角色資料、技能文案、肖像路徑
│   └── high-ai-strategies.json
├── doc/                    # 平衡快照、角色技能與美術提示文件
├── reports/                # 模擬與調校輸出
├── skills/                 # Codex 專案技能說明
├── tools/                  # 測試、模擬、平衡與 AI 策略工具
├── build.js                # 建置腳本
├── index.html              # 遊戲主程式
├── package.json
└── server.js               # 靜態檔案伺服器
```

## 常用指令

```bash
npm run dev                  # 啟動本機開發伺服器
npm run build                # 建置 dist/
npm start                    # 從 dist/ 啟動伺服器
npm test                     # 執行完整回歸測試
npm run test:quick           # 執行較快的測試集合
npm run simulate             # 執行平衡模擬
npm run simulate:run         # 執行排程模擬
npm run simulate:jobs        # 查看模擬工作
npm run tune:balance         # 調校平衡參數
npm run tune:ai-strategy     # 搜尋/調校 AI 策略
npm run evaluate:basic-gate  # 評估基礎 AI 策略門檻
```

## 資料調整

主要可調資料：

- `data/balance.json`：棋盤限制、初始值、食物權重、移動、攻擊、碰撞、模擬設定。
- `data/characters.json`：角色 ID、圖像路徑、偏好食物、角色配色、小招與大招資料。
- `data/high-ai-strategies.json`：高難度 AI 的角色策略權重。

調整資料後建議至少執行：

```bash
npm run test:quick
```

若更動平衡、AI、技能或碰撞規則，建議再跑：

```bash
npm test
npm run simulate
```

## 開發備註

- `index.html` 是目前主要遊戲入口，包含畫面、互動與瀏覽器端邏輯。
- `tools/sim-core.js` 抽出可重用的模擬核心，供測試與平衡工具使用。
- `server.js` 只提供靜態檔案，不含後端遊戲狀態。
- 遊戲設定、最高紀錄、鍵位與重播清單會寫入瀏覽器 `localStorage`。
- 角色圖像有多種尺寸與形態，路徑需與 `characters.json` 中的設定保持一致。

## 文件

- `doc/current-balance.md`：最近一次平衡模擬快照。
- `doc/character-move-details.md`：角色技能規則草稿與設計資料。
- `doc/chibi-portrait-effect-prompts.md`：角色肖像與效果提示詞。

