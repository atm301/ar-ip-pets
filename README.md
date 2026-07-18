# AR IP 夥伴（ar-ip-pets）

掃描客戶產品 → 喚醒對應的 3D IP 角色 → 摸摸/餵食養成互動 → 收集圖鑑 → 集滿兩隻觸發角色對話隱藏劇情。

**Web AR，免安裝 App**：手機瀏覽器開網址、允許相機就能玩（iOS Safari / Android Chrome 皆支援）。

## 技術棧

- [MindAR.js](https://github.com/hiukim/mind-ar-js)（MIT，免費商用）— 自然圖片辨識與追蹤（不是 QR code，直接辨識產品照片）
- [A-Frame](https://aframe.io/) — 3D 場景與角色（目前用基本幾何組裝的可愛角色，正式版換 GLB 模型）
- 純靜態網站，無後端；進度存 localStorage（正式版建議接 Supabase）

## 檔案結構

```
index.html       AR 掃描主頁（辨識 + 互動 + 語音 + 圖鑑 + 配件 + 隱藏劇情）
targets.html     示範圖切換頁（此裝置顯示圖、另一台手機掃）
demo.html        免鏡頭展示模式（提案 demo / 桌機測試用）
admin.html       品牌後台（上傳產品圖→品質評分→編譯辨識檔→綁角色→2D 圖可動化→數據）
characters.json  角色/台詞/配件設定檔（非工程師改這份即可）
characters.js    共用邏輯（3D 組裝、音效、TTS、存檔、統計）
libs/          self-host 的 A-Frame 與 MindAR（不吃 CDN）
targets/         targets.mind 辨識檔（3 張示範圖已編譯）
assets/          demo-1/2/3 示範圖、OG 圖
```

## 快速體驗

1. **手機**開 https://ar-ip-pets.zeabur.app （允許相機）
2. 電腦或另一台裝置開 `/targets.html` 點開任一張示範圖
3. 手機掃它 → 對應角色（麻糬兔/熊布丁/啾啾）在**圖旁邊**彈出、會說話
4. 點角色互動（音效+震動+語音）、餵食、圖鑑、集 2 隻解隱藏劇情
5. 序號兌換配件示範：`/?gift=HAT2026`（小紅帽）、`/?gift=COOL123`（眼鏡）；好感度 Lv.3 自動解鎖圍巾
6. 品牌後台：`/admin.html` 上傳自己的產品照→編譯→「存到此裝置」立即測試

> 桌機沒有相機可直接開 `/demo.html` 看角色互動。

## 換成客戶的產品照（核心 SOP）

1. 每個產品拍一張**正面、光線均勻、無反光**的照片（產品包裝/標籤圖案越複雜辨識越穩；純色或反光面材質辨識效果差）
2. 開啟官方編譯器：**https://hiukim.github.io/mind-ar-js-doc/tools/compile/**
3. 依序上傳所有產品照（**上傳順序 = targetIndex 編號**，第 1 張是 0）
4. 按 Start → 下載 `targets.mind`，放到 `targets/` 並改 `index.html` 裡的
   `imageTargetSrc: ./targets/你的檔名.mind`
5. 在 `characters.js` 的 `CHARACTERS` 為每個產品加一隻角色（對好 `targetIndex`）

## 部署到 Zeabur

1. 到 https://dash.zeabur.com → **New Project**（區域選 Tokyo）
2. **Add Service → Git → 選 `atm301/ar-ip-pets`**（Zeabur 會自動辨識為靜態網站）
3. 部署完成後到 **Networking → Generate Domain**，取得 `xxx.zeabur.app` 網址（自帶 https，相機可用）
4. 之後 push 到 GitHub main 就會自動重新部署

## 正式版架構建議（摘要）

- 角色改用 GLB 模型（含骨骼動畫）：VRoid / Meshy / TripoAI 產模 → Blender 減面 → Draco 壓縮
- 進度上雲：Supabase（跨裝置收集、排行榜）＋匿名登入
- 對話升級：接 Claude API 讓角色能真的「聊天」（性格 prompt 化）
- 多客戶多專案：一份程式碼 + 每客戶一組 config（角色/targets/品牌色），路徑 `/{client}/` 區隔
- 追蹤穩定度要求高的品牌案：評估 8th Wall（約 $700/月/專案）或原生 App（Unity AR Foundation，零授權費）
