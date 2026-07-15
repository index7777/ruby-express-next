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

## 目前狀態（Phase 1~9 系統建置完成 + 接線里程碑,2026-07-15）

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
- ✅ **Phase 9 完成**:BOSS(`systems/boss/`)+ NPC(`systems/npc/`)系統。
  兩者原本完全沒被任何 Phase 碰過(唯二剩下的空白系統資料夾),這次一起做:
  `boss/bossManager.js` 的 `BossManager` 逐字對照原始碼 BOSS 戰核心(傷害
  公式/P1-P2-P3 階段門檻/彈幕生成/訊號干擾+口水噴濺特招/公事包 finisher
  長按 QTE/50%·30% 平衡對抗閘門/死亡復活),`npc/npcManager.js` 的
  `NpcManager` 涵蓋 10 種 NPC(擴音上班族/放閃情侶/亂跑小孩/背包客/站務員/
  捷運警察/清潔隊員/列車長/讓座學生/占位行李客,注意實際是 10 種不是
  README 舊寫的 6 種)的權重抽選/並存互斥/驅散門檻/增益效果。過程中發現
  `config/README.md` 一直沒同步 Phase 1 其實漏搬的 `BOSS_FINISHER_*`
  常數,這次順手補齊;另外抽出共用的 `config/balanceGate.js`(平衡對抗
  物理),BOSS 閘門/背包客擠過來事件共用同一套公式。沙箱 `npm run build`
  (92 modules)+ node 測試腳本 `test-boss.mjs`(54 項斷言)/`test-npc.mjs`
  (42 項斷言)全過,既有 6 支測試回歸也全過。`App.jsx` 新增可以手動觸發
  BOSS 命中/QTE/平衡對抗跟 NPC 生成/驅散的展示區塊。
- ❌ 判定/BOSS 專屬的具名合成音效(playBump/playChime/playDoorOpen 等)
  刻意留到 Judge 接線階段跟 Judge/Boss 邏輯一起搬。
- ❌ 尚未搬入 `web-build/assets/`（166 個檔案）與 `manifest.webmanifest`
  實體檔案（等真的要接上畫面時再一次搬）。

### 🔌 接線里程碑(2026-07-15j:GameEngine/Scene/Camera/Particle/Lighting/UI/BOSS/NPC 全部接進真正畫面)

Phase 1~9 是各自獨立、只有 node 測試驗證過的系統,`App.jsx` 之前的展示
區塊也都只是「手動觸發看數值變化」的示範,沒有真的接成能玩的畫面。這輪
使用者要求「全部一次接完」,把 8 個系統接進兩個真正可以按鍵盤玩的場景:

- **`systems/game/PlayScene.jsx` 擴充**(一般判定測試場,原本 Phase 3
  就有,這次加內容):Perfect/Great 判定會噴粒子、combo 里程碑有碎屑+
  金色光暈、嚴重失衡有暗角警示(Particle+Lighting);離開按鈕/穩定度條
  換成 `Button`/`ProgressBar` 元件(UI);擴音上班族/亂跑小孩/背包客/
  站務員/捷運警察等 NPC 會自動抽選出現,雜訊/炸彈/雙軌行李箱音符真的會
  掉下來讓你打,增益效果真的接進 `gameEngine.js` 既有的 `setBuffXxxUntil`
  API(NPC)。
- **`systems/game/BossScene.jsx` 新增**(BOSS 對戰場):`BossManager` 接
  `gameEngine.js` 原本就寫好、卻沒人接線過的 `phase:"boss"` 分支——彈幕
  真的會依階段變速/變花樣掉下來,打到血量門檻真的會跳出平衡對抗閘門
  (按住 ←/→ 抵抗),打到瀕死真的會跳出公事包 finisher 長按 QTE,死亡會
  跳出復活/重新挑戰/下車三選一,勝利有結算畫面——全部套用 Camera 震動/
  Particle 爆炸粒子/Lighting 階段警示/UI 的 Dialog·ProgressBar·Button。
- `App.jsx` 新增「▶ 進 BOSS 對戰場」按鈕(跟原本「▶ 進判定測試場」並列),
  兩個場景都掛在 `SceneManager` 底下(`"playing"`/`"boss"`)。
- 沙箱驗證:`npm run build`(88 modules)通過,既有 8 支測試(camera/
  judge-parity/miss-wiring/particle/scene/ui/boss/npc,共 234 項斷言)
  全過回歸——但兩個場景本身是 `.jsx`,沒有對應 node 測試腳本可以驗證
  「真的能不能玩」,詳見 `systems/game/README.md`「這次刻意沒做的部分」
  (主遊戲迴圈效能重構/chart 驅動彈幕/存檔哩程系統/BOSS+NPC 同時出現
  都還沒做)。

**麻煩你的部分**(這輪範圍很大,務必兩個新/改過的場景都實測)：
`cd web-build-next && npm install && npm run dev`，打開瀏覽器確認：

1. 畫面顯示「Phase 1+2+4+5+6+7+8+9 搬移驗證 — 全部模組載入正常 ✓」。
2. 「判定測試場」:按 D/F/J/K/L 打音符,確認 Perfect/Great 有粒子噴發、
   combo 到 50/100/200/300 有碎屑+金色光暈、放著不管讓穩定度歸零有暗角
   警示;等一下子應該會看到 NPC(👤 標籤)自動出現,雜訊(📶)/炸彈(💣)
   會掉下來——雜訊打到加分、炸彈打到會扣血/斷 combo、放著讓炸彈自然飛過
   不會扣分。
3. 「BOSS 對戰場」:按 D/F/J/K/L 打彈幕,確認彈幕真的會依 BOSS 血量變快/
   變花樣;打到血量 50%/30% 門檻會跳出「平衡對抗」畫面,按住 ←/→ 試試看
   能不能撐住;打到瀕死會跳出「長壓接住公事包」QTE,按住對應軌道鍵試
   成功/失敗兩種結果;死亡後試「復活接關」跟「重新挑戰」;打贏(把 hp
   壓到 0)看結算畫面。
4. 兩個場景的「離開」按鈕都要能正常回到搬移驗證清單畫面。

四項都確認沒問題後回報，之後會討論主遊戲迴圈效能重構/BOSS chart 驅動
彈幕/存檔系統接線,或規劃下一階段。

### 🔧 接線里程碑後續補完(2026-07-15k:效能優化 + BOSS chart 模式 + 存檔接線)

使用者接著要求把上面提到的三件「之後再討論」的事一次做完:

- **主遊戲迴圈效能優化**:`PlayScene.jsx`/`BossScene.jsx` 原本每幀有 5 個
  以上分開的 `setState` 呼叫,改成收在一個 `viewRef`(普通物件)+ 每幀
  一次 `setRenderTick()`,跟 `ParticleLayer.jsx`/`FxLayer.jsx` 同樣的
  「manager 塞 ref + tick counter 逼重繪」模式。**這不是規格書講的完整
  「game loop 完全脫離 React」重構**(那需要 Canvas/WebGL 渲染),只是
  收斂每幀重複的 setState 呼叫這個較小的優化,詳見 `systems/game/
  README.md`。
- **BOSS chart 驅動彈幕模式**:`BossScene.jsx` 掛載時會 fetch 對應 BOSS
  的 `.normal.json` 譜面,拿得到就照譜面時間點生彈幕(P2/P3 依機率多插
  一顆額外音符),拿不到就退回原本的備援固定間隔模式。**`web-build/
  assets/` 還沒搬進這個專案,fetch 現在一定會失敗,所以目前實際上永遠
  走備援模式**——這段程式碼是「準備好了」,要等資產搬進來才有得測,
  詳見 `systems/boss/README.md`。
- **存檔系統接線**:`BossScene.jsx` 的復活流程不再是 demo 假值,真的呼叫
  `save/loadSave()`/`writeSave()` 檢查/扣 80 點哩程(不夠會顯示「哩程
  不足」擋下來),討伐成功也真的把哩程加回存檔(簡化版公式,拿掉了
  `clearedStations` 乘數,因為 `BossScene` 是獨立 demo 場景沒有這個
  脈絡)。同時修正 `config/README.md`/`save/README.md` 兩份文件跟實際
  進度脫節已久的落差(都一直寫「尚未搬入內容」但檔案早就有完整內容)。
- 沙箱驗證:`npm run build`(88 modules)通過,既有 8 支測試(共 239
  項斷言,新增 `rollExtraChartNote()` 的 5 項斷言)全過回歸。

**麻煩你的部分**:同上一輪的驗證項目都還適用,額外補充:

5. 「BOSS 對戰場」故意送死一次,確認復活時如果哩程點數不夠(存檔剛開始
   應該有 0 點)會顯示「哩程不足」而不能復活,只能選「重新挑戰」或
   「我要下車」。
6. 效能優化/chart 模式/存檔接線這三件事本身不會在畫面上有明顯視覺差異
   (chart 模式現在一定會 fallback、效能優化是內部結構調整),只需要
   確認整體操作起來手感跟上一輪一樣順暢、沒有新出現的當機/卡頓即可。

### 🎵 選曲 / 通勤路線圖(2026-07-15l:SongSelectScene + StageMapScene)

使用者接著要求做「搜尋場景/選曲畫面」,查過原始碼發現實際上有兩種——
「songselect」(自由模式平面歌曲清單,沒有鎖定/星級)跟「stagemap」
(通勤模式 5 站地圖,有真的過關/鎖定狀態),使用者選「兩個都做」:

- **`systems/game/SongSelectScene.jsx` 新增**:對照原始碼自由模式選曲
  畫面,固定用 `data/songs.js` 的 `DEFAULT_TRACKS`(3 首後備曲目),點選
  一首、按「共GO」直接進 `PlayScene`。
- **`systems/game/StageMapScene.jsx` 新增**:對照原始碼通勤模式站點地圖,
  紅寶線 5 站(`STATION_NAMES`,對應 `REDLINE_TRACKS`),真的讀存檔顯示
  過關狀態/最佳分數,用新增的 `save/isStationUnlocked()` 判斷能不能選
  (第 0 站永遠開放,其餘要前面站過關)。
- **`systems/game/PlayScene.jsx` 再擴充**:可選接受 `track`/`stationIndex`
  兩個 prop——有給 `track.chart` 會嘗試 fetch 真正譜面(跟 BOSS chart
  模式同一套「先備援墊著,拿到真資料再換」寫法,一樣因為素材沒搬進來
  目前一定會 fallback);有給 `stationIndex` 的話,關卡結束會真的把過關
  狀態/最佳分數寫回存檔。
- `App.jsx` 新增「▶ 選曲」「▶ 通勤路線圖」兩個按鈕,`"songselect"`/
  `"stagemap"` 場景掛進 `SceneManager`(`SCENE_NAMES` 本來就列過這兩個
  名字)。
- 沙箱驗證:`npm run build`(90 modules)通過,既有測試(239 項斷言)+
  新增 `test-songselect.mjs`(18 項斷言:資料形狀/站點解鎖規則,包含
  記錄既有 `clearedProgress()` 的一個非嚴格連續行為特性,不是這次新增
  的邏輯)全過回歸。

**麻煩你的部分**:

7. 點「▶ 選曲」,確認能看到 3 首歌的清單、點選會換選中標記、按「共GO」
   會進判定測試場(標題會顯示歌名)。
8. 點「▶ 通勤路線圖」,確認全新存檔只有第 1 站能點(其餘顯示 🔒),點
   第 1 站進判定測試場打完後回來,確認第 1 站顯示 ✓ 過關 + 最佳分數,
   第 2 站變成可以點了。

## 系統模組列表

見 `src/systems/*/README.md`：`app` `scene` `game` `ui` `audio` `judge`
`boss` `npc` `camera` `particle` `effect` `save` `config` `assets` `data`。

## 重要提醒

- 這次重構是「保留全部現有功能」的重構，不是重寫新遊戲，任何行為變更都要
  跟你確認過才算數（尤其是 HANDOFF.md 記錄的那些已經修好的 timing/同步
  bug，抽離程式碰到這些地方要格外小心）。
- 沙箱環境沒有真正的瀏覽器可以測試，所有「有沒有真的能玩」的驗證都需要你
  在本機瀏覽器實測後回饋。
