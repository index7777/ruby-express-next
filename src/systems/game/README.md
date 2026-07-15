# game

搬入範圍：主遊戲迴圈（tick），把目前綁在 React `useEffect`/`useRef`裡的每幀
更新邏輯（音符生成/下落、beatClockRef、NPC tick、BOSS tick）抽成獨立、非
React state 驅動的 game loop，React 只負責讀取 loop 狀態來 render UI，減少
不必要的重繪，對應規格書「效能」要求。

## 狀態：兩個可玩畫面已接線 + 效能優化 + chart 模式 + 存檔接線(2026-07-15f/j/k)

- ⚠️ 這份文件先前一直沒更新過(一直寫「尚未實作」),但這個資料夾其實從
  2026-07-15f 起就已經有 `PlayScene.jsx` 了——這是文件跟實際進度脫節的
  既有落差,這次順手修正。
- `PlayScene.jsx`(一般判定測試場):把 Phase 3 `judge/gameEngine.js`、
  Phase 5 `scene/`、Phase 6 `camera/`、Phase 4 `effect/` 接成一個可以按
  D/F/J/K/L 打的最小可玩畫面。**2026-07-15j 擴充**:加上 Phase 7
  `particle/`+`lighting/`(Perfect/Great 判定粒子、combo 里程碑碎屑+金色
  光暈、嚴重失衡暗角警示)、Phase 8 `ui/`(離開按鈕、穩定度條換成
  `Button`/`ProgressBar` 元件)、Phase 9 `npc/`(擴音上班族/亂跑小孩/背包客/
  站務員/捷運警察等 NPC 會自動抽選出現,雜訊/炸彈/雙軌行李箱音符真的會
  掉下來讓你打,增益 NPC 的判定加成也真的接進 `gameEngine.js` 既有的
  `setBuffGoodToPerfectUntil`/`setBuffMissImmuneUntil` API)。
- `BossScene.jsx`(BOSS 對戰場,2026-07-15j 新增):把 Phase 9
  `boss/bossManager.js` 接成一個獨立的 BOSS 對戰畫面,同樣用
  `gameEngine.js`(`phase:"boss"` 分支,這條分支 Phase 3 當初就已經寫好,
  只是沒人接線過)判定彈幕命中,套用 Camera/Particle/Lighting/UI 展現
  階段警示/finisher QTE/平衡對抗閘門/死亡復活流程。**2026-07-15k 再擴充**:
  加上 chart 驅動彈幕模式(掛載時 fetch 對應 BOSS 的 `.normal.json` 譜面,
  拿得到照譜面生彈幕、拿不到退回備援固定間隔模式)+ 真正的 `save/` 系統
  接線(復活真的檢查/扣哩程點數,討伐成功真的加哩程)。
- 兩個場景刻意分開檔案,不是合併成一個「萬用場景」——原始碼的 BOSS 戰
  本來就是完全獨立的 phase,NPC 事件只在一般行駛階段出現,分開寫比塞成
  一個超大 if/else 更貼近原始架構。
- **2026-07-15k 效能優化**:兩個場景原本每幀有 5 個以上分開的 `setState`
  呼叫(音符/彈幕位置、鏡頭震動樣式、NPC 清單、QTE/平衡對抗進度…),改成
  收在一個 `viewRef`(普通物件,不是 React state)裡,每幀只呼叫一次
  `setRenderTick()` 強制重繪,渲染時直接讀 `viewRef.current.xxx`——跟
  `ParticleLayer.jsx`/`LightingLayer.jsx`/`effect/FxLayer.jsx` 早就在用的
  「manager 塞在 ref + 一顆 tick counter 逼重繪」是同一個模式。分數/
  combo/穩定度/HP 這些「事件觸發才變」(不是每幀都變)的顯示狀態沒有必要
  跟著收斂,繼續用一般 React state。
  - ⚠️ **這仍然不是這份 README 開頭講的完整「game loop 完全脫離
    React」重構**——那需要換成 Canvas/WebGL 渲染,每幀更新完全不經過
    React reconciliation,是一個更大、更專門的工程(而且 React 18 的
    automatic batching 讓「同一個 tick 函式裡呼叫幾次 setState」本身
    對重繪次數的影響其實不大,真正的重繪成本大多來自「每幀都要重新算
    一次 JSX 樹」,這點兩種寫法都一樣)。這裡做的是「減少每幀重複建立
    的 state 更新閉包 + 讓資料來源更集中,方便以後真的要換 Canvas 渲染
    時比較好抽換」這個較小、較安全的優化,不是規格書講的完整效能重構。
- 沙箱驗證:`npm run build`(88 modules)通過,既有 8 支測試(camera/
  judge-parity/miss-wiring/particle/scene/ui/boss/npc,共 239 項斷言)
  全過回歸——但這兩個場景本身是 `.jsx` 檔案,沒有對應的 node 測試腳本
  (JSX 需要轉譯,沙箱 node 測試腳本只能測純 `.js` 邏輯模組),兩個場景
  「能不能真的玩」完全沒有經過瀏覽器實測。

## 跟原始碼的差異(刻意設計，不是照抄)

- BOSS 彈幕的「combo」概念是獨立的 `bossCombo`(`gameEngine.js` 的
  `setBossCombo()`,Phase 3 當初就設計好給 BOSS 系統接線用的唯讀
  input),不是一般判定場共用的 `combo`——這是照抄原始碼本來就有的兩套
  分開的連段概念,不是這次接線引入的差異。
- NPC 雜訊/炸彈的 `hitTime` 由 `PlayScene.jsx` 自己用 `t + APPROACH_SEC`
  算,`npc/npcManager.js` 本身不知道呼叫端的譜面時間軸——這個介面設計
  上的職責邊界在 `npc/README.md` 有說明。
- BOSS 討伐成功的哩程獎勵公式簡化過:原始碼是 `floor(score/1000 *
  max(1,clearedStations)) + 50`,`BossScene.jsx` 是獨立 demo 場景沒有
  「已通過幾站」的關卡進度脈絡,拿掉 `clearedStations` 乘數只留
  `floor(score/1000) + 50`,詳見 `save/README.md`。

## 這次刻意沒做的部分

- **主遊戲迴圈重構沒有做到「完全脫離 React」的程度**:見上方效能優化
  說明,只做了「收斂每幀 setState 呼叫次數」這個較小的優化,沒有換成
  Canvas/WebGL 渲染。
- **BOSS 戰跟 NPC 系統沒有同時出現**:原始碼裡 BOSS 戰跟一般 NPC 事件
  是互斥的兩個階段,`BossScene.jsx` 沒有接 NPC 系統。
- **BOSS chart 驅動模式目前一定會 fallback**:`web-build/assets/` 還沒
  搬進這個專案,fetch 譜面一定失敗,詳見 `boss/README.md`。
- **道具/肉鴿卡/雙軌行李箱以外的平衡對抗(一般行駛間的曲道平衡對抗)**
  仍然沒有接——`PlayScene.jsx` 沒有平衡對抗小遊戲,只有 `BossScene.jsx`
  的 50%/30% 血量門檻閘門用到平衡對抗物理。
