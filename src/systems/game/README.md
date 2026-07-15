# game

搬入範圍：主遊戲迴圈（tick），把目前綁在 React `useEffect`/`useRef`裡的每幀
更新邏輯（音符生成/下落、beatClockRef、NPC tick、BOSS tick）抽成獨立、非
React state 驅動的 game loop，React 只負責讀取 loop 狀態來 render UI，減少
不必要的重繪，對應規格書「效能」要求。

## 狀態：四個可玩畫面已接線 + 效能優化 + chart 模式 + 存檔接線(2026-07-15f/j/k/l)

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
- `SongSelectScene.jsx`(自由模式選曲,2026-07-15l 新增):對照原始碼
  songselect phase(2779-2830/4634-4657 行)——平面歌曲清單
  (`data/songs.js` 的 `DEFAULT_TRACKS`),點一首選中、按「共GO」直接進
  `PlayScene`(原始碼這個畫面本身就很單純,沒有星級/鎖定狀態,這裡逐字
  對照,不是簡化過)。
- `StageMapScene.jsx`(通勤模式站點地圖,2026-07-15l 新增):對照原始碼
  stagemap phase(4596-4629 行)——紅寶線 5 站(`data/boss.js` 的
  `STATION_NAMES`,索引對應 `data/songs.js` 的 `REDLINE_TRACKS`),真的
  讀 `save/loadSave()` 的 `stationCleared`/`stationBest` 顯示過關狀態/
  最佳分數,用新增的 `save/isStationUnlocked()` 判斷能不能選(第 0 站
  永遠開放,其餘要前面站過關)。選一站直接進 `PlayScene`(原始碼選站後
  還有進站小遊戲/肉鴿卡三選一才會真的進遊戲,這裡對照 `PlayScene.jsx`
  本來就寫明的範圍邊界跳過這些)。
- `PlayScene.jsx` **2026-07-15l 再擴充**:可選接受 `track`(`{name,file,
  chart}`)跟 `stationIndex` 兩個 prop——有給 `track.chart` 就嘗試 fetch
  真正的譜面 JSON 換掉備援節奏(跟 `BossScene.jsx` chart 驅動模式同一套
  「先備援墊著,拿到真資料再換」寫法,一樣因為 `web-build/assets/` 還沒
  搬進來目前一定會 fallback);有給 `stationIndex` 的話,關卡結束時會真的
  把過關狀態/最佳分數寫回存檔(對照 `StageMapScene` 的入口)。
- 沙箱驗證:`npm run build`(90 modules)通過,既有 8 支測試(camera/
  judge-parity/miss-wiring/particle/scene/ui/boss/npc,共 239 項斷言)+
  新增 `test-songselect.mjs`(18 項斷言:資料形狀/站點解鎖規則)全過回歸
  ——但四個場景本身都是 `.jsx` 檔案,沒有對應的 node 測試腳本(JSX 需要
  轉譯,沙箱 node 測試腳本只能測純 `.js` 邏輯模組),「能不能真的玩」
  完全沒有經過瀏覽器實測。

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
- **`SongSelectScene`/`StageMapScene` 沒有接 `assets/songs.json` 動態
  曲目清單、沒有試聽播放**:前者固定用 `DEFAULT_TRACKS`,後者沒有播放
  原始碼點歌時的 `new Audio()` 循環試聽,詳見兩個檔案開頭註解。
- **選站後沒有進站小遊戲/肉鴿卡三選一**:`StageMapScene` 選站直接進
  `PlayScene`,跳過原始碼 `arrival` phase 的內容。
- **結算/評級畫面沒有做**:通勤模式關卡結束只是把過關狀態/最佳分數寫
  進存檔,沒有完整的準確率/評級/判定分佈結算畫面。

## 2026-07-15l 修正的 bug(使用者實測抓到)

打完通勤路線圖第一站後回報:沒有結算畫面(這是預期中的範圍邊界)、
但畫面會一直閃黑、穩定度一直掉,按返回後第一站沒有標記過關、第二站
也沒解鎖。追查後是同一個根因:

- `PlayScene.jsx` 判斷「這首歌播完了沒」原本用 `notesRef.current.length
  === 0`,但 NPC 系統把占位行李客的雙軌音符也塞進同一個 `notesRef`
  陣列——只要 NPC 還在生新的雙軌音符,這個陣列就永遠不會真的清空,
  「播完」這個條件永遠不成立。
- 因為條件不成立,`tick()` 迴圈永遠不會停(而且原本設計上,就算條件
  成立,迴圈也還是會繼續排下一幀,沒有真的停下來),NPC 抽選/雙軌音符
  生成/過期判 miss 全部繼續無限循環——每一次 miss 都扣穩定度,穩定度
  歸零觸發嚴重失衡,`dangerVignette` 光效觸發一次 2 秒後自動恢復,但因
  為 miss 一直在發生,穩定度立刻又掉到 0,嚴重失衡不斷重新觸發,肉眼看
  起來就是「一直閃黑」。
- 因為「播完」的條件永遠不成立,寫回存檔(`stationCleared`/
  `stationBest`)的那段程式碼也永遠執行不到,所以回到路線圖後第一站
  沒有過關標記、第二站也沒解鎖。

**修法**:
1. 「播完了沒」改成只看備援譜面本身的音符(排除 `kind==="double"` 的
   NPC 雙軌音符),不受 NPC 是否還在生新音符影響。
2. 播完後 `tick()` 迴圈真的整個停掉(不再排下一幀),不只是顯示
   `ended` 文字——這樣 NPC 抽選/雙軌音符生成也會跟著自然停止,不會再有
   後續的 miss/穩定度下降。

`BossScene.jsx` 沒有這個問題:彈幕生成本來就有 `!b.outcome` 條件擋著,
遊戲結束後不會再生新彈幕,不會有同樣的無限迴圈。

## 2026-07-15n 修正的第二個 bug(使用者實測發現上面的修法沒解決問題)

修完上面那個之後使用者重新實測,回報遊玩「全程」(不是只有播完之後)都
會一直掉穩定度、畫面抖動看起來很暗。追查發現是另一個獨立的 bug,在
`isLaneFree(lane)` 判斷式裡:

- `PlayScene.jsx`/`BossScene.jsx` 生成新的雜訊/炸彈/彈幕時,都要檢查
  「這個軌道在它真正落下命中的那個時間點,會不會已經有其他音符/彈幕」,
  避免疊在同一軌道同一時間打不完。但原本的寫法錯誤地拿「現在」的 `t`
  去跟盤面音符的 `hitTime` 比對,而新生成的雜訊/炸彈/彈幕實際上要再過
  `APPROACH_SEC`(1.3 秒)才會落到判定線——等於完全沒檢查到真正會發生
  碰撞的那個未來時間點,反堆疊規則形同虛設。
- 後果(`PlayScene.jsx`):亂跑小孩丟的炸彈很容易跟真正的譜面音符疊在
  同一軌道、同一落下時間。`judgeCore` 的判定順序是「炸彈優先於真音符」
  (見 `judge/gameEngine.js` 233 行附近的分支順序),玩家想打真音符卻被
  系統判定成「打到炸彈」(combo 歸零 + 穩定度 -8),這種誤判持續發生就是
  「一直掉穩定度」;穩定度反覆歸零觸發嚴重失衡的暗角警示反覆疊加,就是
  「畫面抖動全黑」的視覺成因。這是遊玩全程都可能發生的問題,不是只有
  播完之後才有,比前一個 bug(tick 迴圈播完沒真的停)影響範圍更大、更
  根本。
- **修法**:比對式改成用「這個新音符/彈幕真正會落下的時間點」
  (`t + APPROACH_SEC`)去跟盤面既有音符的 `hitTime` 比較,不是用現在的
  `t`。`PlayScene.jsx`(NPC 雜訊/炸彈)跟 `BossScene.jsx`(備援固定間隔
  彈幕模式)都有這個 bug,兩處都已修正;`BossScene.jsx` 的 chart 驅動模式
  本來就是拿 `c.hitTime`(chart 音符自己的時間)比對,寫法一開始就是對的,
  不用改。
- 驗證:沙箱 `npm run build`(90 modules)+ 既有 9 支測試(257 項斷言)
  全過回歸,同樣是 `.jsx` 行為修正,沒有對應 node 測試能直接驗證,需要
  本機瀏覽器重新實測確認。

## 2026-07-15o 修正的第三個 bug(使用者實測發現:combo 50 一觸發畫面就黑掉、一直抖)

上面兩個修完之後使用者繼續實測,發現一個更明確的現象:**combo 一到 50
就會畫面黑掉看不到音符、而且一直抖,不會自己恢復**。追查後是全新的
根因,跟前兩個 bug 都無關,是「時鐘基準不一致」的經典陷阱:

- `PlayScene.jsx` 的 tick 迴圈全程用 `performance.now()`(頁面載入起算的
  毫秒數,數字相對小)當時間基準,呼叫 `camera.getState(now)`/
  `shake.getOffset(now)` 讀值都是傳這個。但 `onComboMilestoneFx` 觸發時
  呼叫 `applyCameraPreset(camera, "comboMilestone", tier)` 跟
  `shake.trigger(6+tier/15, 260)` 都**沒有明確傳 `now`**——這兩個 API
  (沿用 Phase 4/6 既有設計)`now` 參數預設值都是 `Date.now()`(Unix
  epoch 毫秒,一個 13 位數的巨大數字),於是內部記錄的「觸發時間」是
  `Date.now()` 量級,之後 tick 迴圈拿 `performance.now()`(小很多的數字)
  去問「經過多久了」,兩者相減會是一個天文數字大的**負值**。
- 這個巨大負值餵進衰減公式(`decay = 1 - elapsed/durationMs`)會算出
  天文數字大的縮放/位移量,而且因為 `performance.now()` 幾乎必定小於
  `Date.now()` 那個巨大時間戳,`isActive(now)`(判斷特效還在不在播)會
  **永遠判定為 true**,特效永遠不會結束——這解釋了「一觸發就再也不會
  恢復」;而位移量的偽隨機是用 `now`(每幀持續前進的 `performance.now()`)
  當 seed 算的,每幀數值都在變,巨大的位移量疊上每幀變化的偽隨機,肉眼
  看起來就是「一直抖」;鏡頭被縮放/位移到天文數字大的程度,畫面內容
  (音符/軌道)實質上被推到螢幕外或縮到看不見,只剩容器本身的深色背景,
  就是「黑畫面看不到音符」。
- **修法**:`onComboMilestoneFx` 裡呼叫 `shake.trigger()`/
  `applyCameraPreset()` 時明確補上 `performance.now()` 當 `now` 引數,
  跟這個場景 tick 迴圈全程用的時鐘基準對齊。`BossScene.jsx` 沒有這個
  問題(它從來沒呼叫過 `shake.trigger()`/`applyCameraPreset()`,只用
  `getOffset()`/`getState()` 讀值,沒有寫入)。
- ⚠️ **一般性教訓**:`camera/cameraManager.js`、`effect/shake.js` 這類
  「`now` 參數預設 `Date.now()`」的 API,只要呼叫端自己的 tick 迴圈是用
  `performance.now()`,任何一次呼叫忘記明確傳 `now` 都會踩到這個陷阱
  ——之後任何新場景要用這兩個系統,務必檢查呼叫端跟這兩個系統之間的
  `now` 是不是同一個時鐘基準,不要依賴預設值。
- 驗證:沙箱 `npm run build`(90 modules)+ 既有 9 支測試(257 項斷言)
  全過回歸(既有測試本來就用一致的明確 `now` 呼叫,不會踩到這個陷阱,
  這次是呼叫端整合時的疏漏,不是 `camera`/`effect` 兩個系統本身的
  bug)。需要本機瀏覽器重新實測確認。
