# Ruby Express · 商業化重構（web-build-next）

這是「共GO 商業化重構規格」的新專案骨架，跟現有 `web-build/`（單檔零建置版，
目前正式上線中）並存、互不影響。**在這個重構完成、實機測試通過之前，
`web-build/` 是唯一應該部署/上架的版本，不要動它。**

## 為什麼換成 Vite

- 規格書要求「完整模組化」，單檔 `index.html` + CDN React + Babel 瀏覽器內
  即時轉譯做不到真正的 ES module 拆分，只能用多個 `<script>` 標籤模擬，
  跟規格要求有落差。
- Vite build 完還是純靜態檔案（`dist/`），一樣可以直接部署到 GitHub Pages /
  Vercel，不影響現有部署平台，只是要多一個 `npm run build` 的步驟。
- 之後如果要進一步「上架」（例如包裝成 PWA、或用 Capacitor/Tauri 包成 App
  上架），都需要真正的 bundler，現在換掉風險最低。

## 本機開發

```bash
cd web-build-next
npm install
npm run dev       # 本機開發伺服器，有 HMR 熱更新
npm run build     # 產生 dist/，部署用
npm run preview   # 本機預覽 build 出來的 dist/
```

## 異地同步

這個資料夾現在獨立於 `ruby-express`（Google Drive）之外，用自己的 GitHub
repo 同步，避免 `node_modules` 塞爆 Drive 同步。資料夾根目錄的 `sync.bat`
雙擊後有選單：`[1]` 拉取最新、`[2]` 推送目前變更、`[3]` 查看狀態。換機器
工作前後記得都要跑一次。詳見 `ruby-express` 主 repo 的 `HANDOFF.md`
「🔄 異地同步」一節。

## 目前狀態（Phase 8 完成 + Phase 7 + Phase 6 + Phase 5 + Phase 4 + Phase 3 GameEngine 核心實作完成，2026-07-15）

- ✅ Vite + React 18 建置骨架，`npm run build` 已在沙箱驗證可正常編譯。
- ✅ 15 個系統模組資料夾已建立於 `src/systems/`，每個資料夾都有
  `README.md` 說明搬入範圍與目前狀態。
- ✅ **Phase 1 完成**：`config`（燈軌/時間軸/判定窗/combo/平衡/傷害/道具等
  常數）、`assets`（ART 素材路徑表）、`save`（localStorage 存讀檔邏輯）、
  `data`（BOSS/NPC/肉鴿卡/成就/每日任務/路線/曲目清單/公告排行榜）、
  `judge`（accRank/starRating/buildChart 計分工具）都已從
  `web-build/index.html` 逐字搬過來，數值與邏輯完全不變。
- ✅ **Phase 2 完成**：統一 Audio System（`systems/audio/`）——BGM 三頻道
  （遊戲/選單/試聽，逐字保留「遊戲頻道跟選單頻道不共用同一顆 `<audio>`,
  避免關卡曲/BOSS曲/結算曲互相重疊」這個原始碼的刻意設計）、環境音（車廂
  行駛底噪）、SE（含刷票口嗶聲的 resume-before-schedule 保護,修復過的 bug
  沒有被改回去）、**新增**的音量分類（BGM/SE/Voice/Ambient/Announcement）+
  ducking 模型。
- ✅ **Phase 4 完成**：FX Library + 打擊感基礎建設（`systems/effect/`）——
  `ANIMATIONS` 共用動畫規格表（9 種）、`FxManager`（10 種特效生成/過期
  管理）、`ScreenShake`（震動強度+時長衰減模型）、`HitStop`（打擊停頓
  判斷）、`FxLayer.jsx`（可重複使用的 React 渲染層）。這次刻意只建「系統
  本身」，沒有接進真正的判定邏輯（見 `systems/effect/README.md`）。
- ✅ **Phase 3 GameEngine 核心實作完成**：用 Bridge Pattern 把
  `judgeLane`/`registerHit` 拆成 Input/Logic/Output 三段，`gameEngine.js`
  涵蓋全部判定分支，配合獨立轉譯的 `legacyReferenceModel.js` 做了 8 組
  場景、16 項 parity 測試(`test-judge-parity.mjs`)全數通過，過程中抓到
  並修正 2 個重構本身的 bug。**架構規範(Contract 1/2/3)寫在 `ruby-express`
  主 repo 的 `HANDOFF.md`,詳細內容見 `systems/judge/README.md`。完全沒有
  接進 `web-build/index.html`,也沒有接進任何畫面。**
- ✅ **Phase 5 完成**：Scene Manager（`systems/scene/`）——`SceneManager`
  類別提供 `register(name, {onEnter, onUpdate, onExit})` / `goto(name,
  data)` / `back(data, fallback)` / `update(dt, data)` / `clearHistory()`，
  取代原本散落在 20 個按鈕/函式裡的 `setPhase("xxx")` 直接切換方式。這是
  **新建的通用基礎設施**，不是逐字搬移原始碼邏輯（原始碼的 phase 切換
  副作用寫法太分散，沒辦法逐行對照搬）。沙箱 `npm run build`（62
  modules）+ node 測試腳本 `test-scene.mjs`（25 項斷言）全過。`App.jsx`
  新增一個可以手動點擊切換場景、看切換紀錄的展示區塊。
- ✅ **Phase 6 完成**：Camera 系統（`systems/camera/`）——`CameraManager`
  提供持續性 tween(`zoomTo`/`panTo`/`focusOn`)+ 一次性 impulse(沿用
  Phase 4 ScreenShake 衰減模型的 `punchZoom`/`slowMotion`)，`getState()`
  一次拿到 `{zoom, x, y, timeScale}`。`presets.js` 的 `CAMERA_PRESETS`
  對照 README 寫的四個套用時機（BOSS 登場/技能/combo 里程碑/BOSS 死亡）
  提供參考用法，純文件，沒有被任何畫面實際呼叫。`timeScale` 只是建議
  的慢動作倍率，刻意沒有接進任何 tick 迴圈，避免相機效果影響判定手感。
  沙箱 `npm run build`（65 modules）+ node 測試腳本 `test-camera.mjs`
  （27 項斷言）全過，`App.jsx` 新增可以手動觸發各 preset、即時看數值
  的展示區塊。
- ✅ **Phase 7 完成**：Particle + Lighting 系統（`systems/particle/`）——
  `ParticleManager`(歸還池復用、`emit()`角度/速度範圍噴發、`update(dt)`
  純數學位移模擬、`prune()`就地移除到期粒子)、`LightingManager`(多頻道
  觸發後線性衰減,同頻道內較弱觸發不打斷較強觸發,沿用 Phase 4 ScreenShake
  的衰減模型)、`ParticleLayer.jsx`/`LightingLayer.jsx`(比照
  `effect/FxLayer.jsx`「傳入 manager + 自跑 rAF + setTick 強制重繪」結構
  的可重複使用渲染層)。`presets.js`/`PARTICLE_PRESETS`(comboMilestone/
  perfectHit/greatHit/explosion/trail)+ `LIGHTING_PRESETS`(bossPhaseAlert
  P2/P3/dangerVignette/comboAura)純文件參考,沒有被任何畫面實際呼叫。
  沙箱 `npm run build`（74 modules）+ node 測試腳本 `test-particle.mjs`
  （32 項斷言:粒子物理積分/歸還池復用/存活判斷 + lighting 衰減/多頻道
  互不打斷/較弱不打斷較強規則)全過,既有 4 支測試(camera/judge-parity/
  miss-wiring/scene)回歸也全過。`App.jsx` 新增一個可以手動觸發各 preset、
  即時看粒子噴發跟光效疊層的展示區塊。
- ✅ **Phase 8 完成**：UI 設計系統(`systems/ui/`)——排查後發現
  `GameButton`/`styles` 並非孤兒引用,而是 `web-build/index.html` 6492 行裡
  真的存在、真的被 7 處呼叫的既有元件/樣式物件(定義在 5874/5970 行),這次
  是把這套真的共用的語言逐一對照搬過來、整理成有名字的 tokens,不是憑空
  設計新系統。`tokens.js`(COLORS/RADIUS/SHADOW/SPACING/FONT/TRANSITION,
  每個常數都標明抄自哪個既有 style key)、`utils.js`(純邏輯:`clamp01`/
  `stabilityColor`——逐字對照原始碼 3764 行穩定度三段閾值/`progressColor`)、
  `Button.jsx`(搬自真的存在的 `GameButton`,pointerDown/Up/Leave/Cancel
  四事件都保留)、`Panel.jsx`(合併 `resultPanel`/`tiltAskCard`)、
  `Card.jsx`(合併 `routeCard`/`songCard`/`stationRow`)、
  `ProgressBar.jsx`(合併 `stabilityTrack`/`stabilityFill`/`balanceBar`)、
  `Dialog.jsx`(對照 `tiltAskOverlay`+`tiltAskCard`)。沙箱 `npm run build`
  (82 modules)+ node 測試腳本 `test-ui.mjs`(26 項斷言)全過,既有 5 支
  測試回歸也全過。`App.jsx` 新增獨立展示區塊(不動任何已驗證過的舊畫面)。
- ❌ 判定/BOSS 專屬的具名合成音效(playBump/playChime/playDoorOpen 等)
  刻意留到 Judge 接線階段跟 Judge/Boss 邏輯一起搬。
- ❌ 尚未搬入 `web-build/assets/`（166 個檔案）與 `manifest.webmanifest`
  實體檔案（等真的要接上畫面時再一次搬）。

**麻煩你的部分**：`cd web-build-next && npm install && npm run dev`，打開
瀏覽器確認：(1) 畫面顯示「Phase 1+2+4+5+6+7+8 搬移驗證 — 全部模組載入正常
✓」；(2) 點一下「▶ 播放刷票口嗶聲測試」按鈕，確認真的聽到兩聲
「嗶—嗶—」；(3) 在 FX 展示區塊點過 10 種特效按鈕、Screen Shake、Hit
Stop；(4) 在 Scene Manager 展示區塊點幾個 goto 按鈕跟 back()；(5) 在
Camera 展示區塊點過各個 BOSS/Combo 按鈕，確認畫面框真的有縮放/平移
效果、上方數值有跟著變化；(6) 在 Particle / Lighting 展示區塊點過 5 種
粒子 preset 按鈕(確認框內真的有粒子噴發/飛出去/消散)跟 4 種光效 preset
按鈕(確認框內有色調疊層跟著淡入淡出)；(7) 在新增的 UI 設計系統展示
區塊點過三種 Button variant、點過 Card 切換選中、用按鈕調過 ProgressBar
數值(確認顏色隨數值三段變化)、點開/關過 Dialog。七項都確認沒問題後
回報，之後會討論 GameEngine/Scene Manager/Camera/Particle/Lighting/UI
要不要開始接線、或先做 Phase 9(下一階段規劃)。

## 系統模組列表

見 `src/systems/*/README.md`：`app` `scene` `game` `ui` `audio` `judge`
`boss` `npc` `camera` `particle` `effect` `save` `config` `assets` `data`。

## 重要提醒

- 這次重構是「保留全部現有功能」的重構，不是重寫新遊戲，任何行為變更都要
  跟你確認過才算數（尤其是 HANDOFF.md 記錄的那些已經修好的 timing/同步
  bug，抽離程式碰到這些地方要格外小心）。
- 沙箱環境沒有真正的瀏覽器可以測試，所有「有沒有真的能玩」的驗證都需要你
  在本機瀏覽器實測後回饋。
