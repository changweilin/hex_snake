# 連線伺服器部署指南（Render）

把 Hex Snake 的 LAN/Wi-Fi 連線中繼（relay）部署到雲端，讓兩支裝置在**任何網路**（不同 Wi-Fi、手機熱點、4G）都能配對對戰，不必處在同一個區域網路。

## 運作原理（先懂這個再部署）

連線採**中繼伺服器模式**，不是手機對手機直連。client 永遠連回「載入網頁的那台主機」：

```js
// src/network.js
return `${protocol}//${window.location.host}/ws`;
```

`server.js` 同時做兩件事：① 提供遊戲網頁 ② 提供 `/ws` WebSocket relay。
所以只要把 `server.js` 部署到 Render，從 Render 網址開遊戲時，就會自動連到同一個網址的 relay——一個 URL 搞定前端與連線。

> ⚠️ WebSocket relay 需要**常駐的 Node 程序**，不能用 serverless / 靜態主機。
> GitHub Pages、Vercel/Netlify Functions、Cloudflare Pages **都不行**；GitHub Pages 只能放靜態網頁（無法多人連線）。

## 前置需求

- 一個 GitHub 帳號（repo 已推上 GitHub）
- 一個 [Render](https://render.com) 帳號（免費方案即可）
- repo 內已有：
  - `render.yaml` — Render Blueprint（build/start 設定）
  - `.github/workflows/deploy-render.yml` — 選用的自動部署 workflow

## 部署步驟

### 1. 把設定檔推上 GitHub

確認 `render.yaml` 與 `.github/workflows/deploy-render.yml` 已 commit 並 push 到 `master`（或 `main`）。

### 2. 在 Render 建立服務（Blueprint）

1. 登入 Render → 右上 **New** → **Blueprint**
2. 連結並選擇本 repo（首次需授權 GitHub）
3. Render 會自動讀取 `render.yaml`，顯示一個名為 **hex-snake** 的 Web Service
4. 按 **Apply** / **Create**，Render 開始建置（`npm ci && npm run build`）並啟動（`node server.js --dist`）
5. 等狀態變 **Live**，取得網址，例如：`https://hex-snake.onrender.com`
   （名稱可能被加上隨機後綴，以 Render 顯示為準）

`render.yaml` 已設定：

| 項目 | 值 | 說明 |
|------|----|------|
| `buildCommand` | `npm ci && npm run build` | 安裝相依並產生 `dist/` |
| `startCommand` | `node server.js --dist` | 提供 dist 靜態檔 + `/ws` relay |
| `plan` | `free` | 免費方案 |
| `healthCheckPath` | `/api/network-urls` | server.js 回 200 JSON 作為存活探測 |
| `HOST` env | `0.0.0.0` | 綁全部介面 |
| `PORT` | （Render 自動注入） | `server.js` 讀 `process.env.PORT` |
| `autoDeploy` | `true` | push 後 Render 自動重新部署 |

### 3.（選用）開啟 GitHub Actions 自動部署 + CI 把關

`render.yaml` 的 `autoDeploy: true` 已能讓 Render 在 push 後自動部署。
若想在部署前**先跑 relay 路由測試把關**，再啟用本 workflow：

1. Render → 你的服務 → **Settings** → **Deploy Hook** → 複製 Hook URL
2. GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Secret: 貼上 Hook URL
3. 之後 push 到 `master`/`main` 時，workflow 會：
   `npm ci` → `npm run test:network`（relay 路由測試）→ 觸發 Render 部署

> 未設定該 secret 時，workflow 的部署步驟會自動略過，不會失敗。

### 4. 實測連線

1. 兩支裝置都用瀏覽器開 Render 網址（如 `https://hex-snake.onrender.com`）
2. 一方按 **Link** → **Host**，取得 4 碼房號（或讓對方掃 QR）
3. 另一方按 **Link** → 輸入房號
4. 雙方看到「LAN room ready (2/2)」、按鈕顯示連線方式（Wi-Fi / LAN）→ 按開始對戰
5. 再點一次連線按鈕即可斷線

## 注意事項

- **免費方案會休眠**：閒置約 15 分鐘後休眠，下一次連線冷啟動約 30–50 秒；casual 對戰可接受。怕慢可改用 Railway / Fly.io 或升級 Render 付費方案。
- **連線方式標示**：手機 / Capacitor WebView 能讀到 `navigator.connection.type`，Wi-Fi 顯示 `Wi-Fi`、有線顯示 `LAN`；桌面瀏覽器讀不到時預設顯示 `Wi-Fi`。
- **GitHub Pages 並存**：既有的 `deploy.yml` 仍會把靜態網頁部署到 GitHub Pages，但 Pages **沒有 relay**，該網址無法多人連線——**多人對戰請用 Render 網址**，Pages 可留作單機展示。
- **打包的 App（APK/iOS）**：目前從 `https://localhost` 載入靜態檔，沒有 relay 目標，無法多人連線。若要讓安裝版也能連線，需另外讓 App 指向 Render 網址（可再開需求）。

## 本機驗證（部署前自我檢查）

```bash
npm run build                 # 產生 dist/
node server.js --dist         # 以 production bundle 啟動
npm run test:network          # relay 路由測試
```

開兩個瀏覽器分頁連 `http://localhost:6287`，Host / Join 測試配對即可。

## 其他可選平台

| 平台 | 免費條件 | 備註 |
|------|---------|------|
| Render ⭐ | 免費 Web Service，自帶 HTTPS | 最好上手，會休眠 |
| Railway | 每月少量免費額度 | 簡單，額度用完需付費 |
| Fly.io | 小型 VM 免費額度（需綁卡） | 延遲低、可選區域 |
| Koyeb / Glitch / Replit | 免費、支援 WS | 會休眠、穩定度較低 |

> 免費方案條件常變動，請以平台當下說明為準。Fly.io / Koyeb 可另外用 Dockerfile 部署（需要可再提供）。
