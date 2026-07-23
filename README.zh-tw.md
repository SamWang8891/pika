<div align="center">

<img src="/readme_image/Pika-full-logo.svg" width="300" alt="Pika Logo">

# Pika

<img src="https://img.shields.io/badge/Version-v5.0.0-green">

一個簡單的短網址器，將網址轉換為易於記憶的英文單字，使其容易記憶。.

[Link for English version](README.md)

</div>

---

> [!IMPORTANT]
> **v5 完全運行在 Cloudflare Workers + D1 上。** 一個 Hono worker 同時提供 React SPA、
> `/api/v4` API 以及短網址導向；資料庫使用 D1。自架版的
> FastAPI + nginx + Docker 架構止於
> [v4.0.0](https://github.com/SamWang8891/pika/releases)，該版本仍可在發行頁面下載。

---

## 目錄 📖

- [為什麼將專案命名成 "Pika" ❓](#為什麼將專案命名成-"pika"-?)
- [特點 ✨](#特點-)
- [截圖 📸](#截圖-)
- [用法 🚀](#用法-)
    - [部署 ⚙️](#部署-)
    - [導向行為 🔀](#導向行為-)
    - [管理員頁面 🛡](#管理員頁面-)
    - [重設管理員密碼 🔑](#重設管理員密碼-)
    - [速率限制 🕒](#速率限制-)
    - [客製化字典 📚](#客製化字典-)
- [開發 🛠](#開發-)
    - [檔案結構 🗄](#檔案結構-)
    - [事前準備 ✅](#事前準備-)
    - [本機執行 🚧](#本機執行-)
    - [腳本存取 API 🤖](#腳本存取-api-)
- [鳴謝 🙏](#鳴謝-)
- [備註 📝](#備註-)
    - [使用的外部資源 💿](#使用的外部資源-)
    - [已知的bug 🐛](#已知的bug-)
    - [隱藏的功能 🙈](#隱藏的功能-)
- [問題 / Bugs? 🙋‍♀️](#問題--bugs-)

---

## 為什麼將專案命名成 "Pika" ❓

"Pika" 是兔鼠的英文。兔鼠以「小隻」、「移動速度快」以及「跳得高」聞名，故我將此專案命名成 "Pika" 以彰顯此專案的程式空間佔用小且跑得很快。

## 特點 ✨

覺得隨機產生的網址太難記住了嗎？這個專案提供了另一個解決辦法：

- 生成易於記憶的縮短網址，例如 [https://example.com/apple](https://google.com)。
- 縮短網址也可以自定義。
- 由伺服器端以 HTTP `307` 導向，因此短網址在瀏覽器以及 `curl`、PowerShell 的 `irm` 等命令列工具中皆可使用。
- Apple 手機網頁應用程式功能——將其添加到主螢幕，以獲得全螢幕應用程式般的體驗。
- 支援淺色和深色模式。
- 自定義字典，客製化隨機生成的短網址。
- 運行在 Cloudflare 的免費方案上——不需要維護伺服器。

---

## 截圖 📸

<div align="center">

<table>
    <thead>
        <tr>
            <th style="text-align: center;">淺色模式 ⚪</th>
            <th style="text-align: center;">深色模式 ⚫</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td align="center">
                <img src="readme_image/main-light.png" alt="Main Page Light Mode" width="600"/><br/>
                🏠⚪ 主頁面淺色模式
            </td>
            <td align="center">
                <img src="readme_image/main-dark.png" alt="Main Page Dark Mode" width="600"/><br/>
                🏠⚫ 主頁面深色模式
            </td>
        </tr>
        <tr>
            <td align="center">
                <img src="readme_image/main-qr-light.png" alt="Main Page Light Mode with QR Code" width="600"/><br/>
                🏠⚪🔗 主頁面 QR Code 淺色模式
            </td>
            <td align="center">
                <img src="readme_image/main-qr-dark.png" alt="Main Page Dark Mode with QR Code" width="600"/><br/>
                🏠⚫🔗 主頁面 QR Code 深色模式
            </td>
        </tr>
        <tr>
            <td align="center">
                <img src="readme_image/admin-light.png" alt="Admin Page 淺色模式" width="600"/><br/>
                🛡⚪ 管理員頁面淺色模式
            </td>
            <td align="center">
                <img src="readme_image/admin-dark.png" alt="Admin Page Dark Mode" width="600"/><br/>
                🛡⚫ 管理員頁面深色模式
            </td>
        </tr>
    </tbody>
</table>

</div>

---

## 用法 🚀

### 部署 ⚙️

需要一個 Cloudflare 帳號（免費方案即可）以及 [pnpm](https://pnpm.io)。

1. 安裝依賴並登入 Cloudflare：
   ```bash
   pnpm install
   pnpm wrangler login
   ```
2. 建立 D1 資料庫，並將其印出的 `database_id` 貼到 `wrangler.jsonc`：
   ```bash
   pnpm wrangler d1 create pika
   ```
3. 建立資料表並植入字典與管理員帳號：
   ```bash
   pnpm db:migrate
   ```
4. 設定密鑰：
   ```bash
   pnpm wrangler secret put SECRET_KEY    # 例如 openssl rand -hex 64
   pnpm wrangler secret put BEARER_TOKEN  # 例如 openssl rand -hex 16
   ```
5. 部署（`run` 不可省略——`pnpm deploy` 是 pnpm 的內建指令，不會執行這個 script）：
   ```bash
   pnpm run deploy
   ```
6. 大功告成！若想讓短網址使用自己的網域，可為 worker 加上
   [自訂網域](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

### 導向行為 🔀

短網址由 worker 解析，並回傳 HTTP `307 Temporary Redirect`，中間不會渲染任何頁面，因此短網址在任何 HTTP 客戶端皆可使用：

```bash
curl -L https://example.com/apple
```

```powershell
irm https://example.com/apple | iex
```

使用 `307` 而非 `301` 是刻意的設計。當短網址過期後，其關鍵字會被歸還至字典中，日後可能被指派給不同的網址；而 `301`
會被瀏覽器永久快取，導致訪客持續被導向至舊的目的地。

> ⚠️ 將短網址直接以管線傳入 shell 執行，等同執行該筆記錄當下所指向的任何內容，且任何具有管理員權限的人都能更改其指向。
> 請僅對自己掌控的連結這樣做。

### 管理員頁面 🛡

在 `https://example.com/admin` 訪問管理員面板。

預設管理員帳號：

```plaintext
使用者: admin
密碼: password
```

請在第一次登錄後更改密碼。

### 重設管理員密碼 🔑

忘記密碼了嗎？將密碼重設回 `password`（`\$` 跳脫字元不可省略——雜湊值中含有 `$`）：

```bash
pnpm wrangler d1 execute pika --remote --command "UPDATE login SET password='pbkdf2\$100000\$I/3PIRTUbXeLEOYhShbQrw==\$gT/GEuB1CrPa7URCcXVcOa8Pis48gWlA5yeq94SoLjQ=' WHERE username='admin'"
```

### 速率限制 🕒

worker 本身沒有速率限制（舊版 nginx 的每秒 10 次規則已移除）。若有需要，可在你的 zone 上新增
[Cloudflare WAF 速率限制規則](https://developers.cloudflare.com/waf/rate-limiting-rules/)——它會在
worker 之前生效，且可依路徑設定。

### 客製化字典 📚

隨機關鍵字來自 `migrations/0002_seed_dictionary.sql` 的單字池。請在執行 `pnpm db:migrate` **之前**
編輯它。單字只能包含英數字元（`A-Za-z0-9`）。

**保留字：**
請避免使用以下單字：
`login`、`admin`、`logout`、`api`、`index`、`index.html`、`change_pass`。這些單字永遠無法被當作關鍵字使用。

---

## 開發 🛠

### 檔案結構 🗄

- `src/client`：React SPA（Vite、TypeScript）——頁面、元件、主題、API 客戶端。
- `src/server`：Hono worker——`/api/v4`、短網址導向、SPA 靜態資源。
- `src/shared`：前後端共用的型別與常數。
- `migrations`：D1 資料表結構與字典種子。

### 事前準備 ✅

1. Node.js >= 22
2. pnpm

### 本機執行 🚧

```bash
pnpm install
pnpm db:migrate:local   # 本機 D1，位於 .wrangler/
pnpm dev                # Vite 開發伺服器，含 worker 與本機 D1
```

本機密鑰放在 `.dev.vars`（可複製 `.dev.vars.example`）。`pnpm check` 會做型別檢查與建構；
`pnpm preview` 會在本機以正式版建構執行。

### 腳本存取 API 🤖

需要驗證的 API 端點（`change_pass`、`delete_record`、`get_all_records`、`delete_all_records`）
可改用 `Authorization: Bearer <BEARER_TOKEN>` 標頭取代 session cookie，腳本不需登入。
Bearer token 在 `change_pass` 上也會跳過目前密碼的檢查。

---

## 鳴謝 🙏

感謝 [@xinshoutw](https://github.com/xinshoutw) 在此專案提供幫助 😄。

感謝俍曄提供UI設計的協助 🎨。

---

## 備註 📝

### 使用的外部資源 💿

- [Google Fonts](https://fonts.google.com/icons) 的 SVG 檔案

### 已知的bug 🐛

- QR Code Styling: QR code styling 所產生的 QR Code 可能無法在所有裝置上顯示，尤其是全平台的Safari。

### 隱藏的功能 🙈

- 在首頁縮短網址的表單框框的下面中間有一個隱藏且隱形的按鈕，按下可直接重新導向到管理員頁面。

---

## 問題 / Bugs? 🙋‍♀️

遇到問題 / bugs？想要提出新點子？歡迎開新 Issues。
