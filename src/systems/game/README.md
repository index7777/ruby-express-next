# game

搬入範圍：主遊戲迴圈（tick），把目前綁在 React `useEffect`/`useRef`裡的每幀
更新邏輯（音符生成/下落、beatClockRef、NPC tick、BOSS tick）抽成獨立、非
React state 驅動的 game loop，React 只負責讀取 loop 狀態來 render UI，減少
不必要的重繪，對應規格書「效能」要求。

## 狀態：四個可玩畫面已接線 + 效能優化 + chart 模式 + 存檔接線 + 素材搬入 + 道具/肉鴿卡(2026-07-15f/j/k/l/q/r)

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
  「先備援墊著,拿到真資料再換」寫法);有給 `stationIndex` 的話,關卡
  結束時會真的把過關狀態/最佳分數寫回存檔(對照 `StageMapScene` 的入口)。
  **2026-07-15q 更新**:`web-build/assets/` 已經搬進 `public/assets/`,
  這個 fetch 現在真的能抓到 `REDLINE_TRACKS`/`DEFAULT_TRACKS` 對應的
  `.normal.json` 譜面,不再永遠 fallback,詳見 `assets/README.md`。
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

- ~~**主遊戲迴圈重構沒有做到「完全脫離 React」的程度**:見上方效能優化
  說明,只做了「收斂每幀 setState 呼叫次數」這個較小的優化,沒有換成
  Canvas/WebGL 渲染。~~ **2026-07-16 第二輪已補上第一個實質切片**——
  兩個場景「軌道底色/音符/彈幕/炸彈/雜訊」這塊(每幀持續變動、數量會
  累積、原本每顆都是一個 React DOM 節點的部分)改成單一 `<canvas>` 每幀
  直接畫,不再產生任何 DOM 節點,見下方新章節。**仍然不是完整重構**:
  `ParticleLayer.jsx`/`LightingLayer.jsx`/`effect/FxLayer.jsx`(各自獨立
  的既有系統)、鏡頭/震動 transform、HUD 面板都刻意維持原樣不動,範圍
  刻意只框在「React 每幀重繪負擔最大的地方」。
- **BOSS 戰跟 NPC 系統沒有同時出現**:原始碼裡 BOSS 戰跟一般 NPC 事件
  是互斥的兩個階段,`BossScene.jsx` 沒有接 NPC 系統。
- ~~BOSS chart 驅動模式目前一定會 fallback~~:2026-07-15q 素材搬入後
  已經真的能 fetch 到譜面,不再永遠 fallback,詳見 `boss/README.md`。
- ~~四個場景的視覺呈現還是純色塊/emoji,沒有套用真正的美術素材~~:
  **2026-07-16 已補上一輪(A 類)**——
  - `PlayScene.jsx`:車廂/月台背景(`ART.stationScene`)、五軌底紋
    (`ART.laneTrack`)、五種音符/雙軌行李箱音符改用真圖(`ART.note.*`/
    `ART.noteDouble`,保留原本色塊當發光後備)、炸彈/雜訊改用真圖
    (`ART.bomb`/`ART.noise`,取代 💣/📶 emoji)、NPC 清單圖示
    (`ART.npc.*`,取代 👤 emoji)、道具按鈕 icon(`ART.item.*`)。
  - `BossScene.jsx`:發現 `data/boss.js` 的 `BOSSES` 清單其實早就準備好
    每隻 BOSS 的 P1/P2/P3 立繪(`base`/`p2`/`p3`)+ 三階段背景
    (`bg`/`bg2`/`bg3`),只是這筆資料之前只有 `bgm` 欄位被讀過——這次
    補上依 `phase` state 切換的 BOSS 立繪 + 背景疊圖。**已知素材缺口**:
    `yaksha`(擴音夜叉)目前只有橫幅/BGM,沒有 P1/P2/P3/開場立繪檔案
    (`redline`/`glutton`/`birdman` 三隻都齊全),選到夜叉時立繪 `<img>`
    會顯示瀏覽器預設破圖示,這是美術產出缺口,不是接線邏輯的 bug——
    **2026-07-16 第二輪已補上 `onError` fallback**,見下方新章節。
    ~~彈幕本體(`bossBullet`)/攻擊特效疊圖(訊號干擾/口水噴濺/公事包)
    還沒套用,留到下一輪~~:**2026-07-16 第二輪已套用**,見下方新章節。
  - `SongSelectScene.jsx`:選曲背景(`ART.songselectBg`)+「共GO」按鈕
    美術(`ART.gogoBtn`)。
  - ~~`StageMapScene.jsx` 這次刻意沒動~~:**2026-07-16 第二輪已套用**
    (`ART.stagemapBg` 背景 + `ART.routeMap` 裝飾性橫幅),見下方新章節。
  - 另外盤點時發現 `public/assets/` 有 19 張 `card-*.png` 肉鴿卡插圖,
    檔名跟卡片 `id` 逐字對應(`card-${card.id}.png`),但 `art.js` 的
    `ART` 物件完全沒有收錄——這批素材目前是「孤兒檔案」,沒有任何
    manifest 入口可以讀到,是後續一輪很明確的高價值目標,這次沒做
    (需要先幫 `art.js` 補一個 `cardArt(id)` 或等效的動態路徑組合方式,
    範圍稍微超出單純「套用既有 manifest」)。**2026-07-16 第二輪已補上**
    `cardArt(id)` 並套用到兩個場景的抽卡 Dialog,見下方新章節。
- ~~道具/肉鴿卡/雙軌行李箱以外的平衡對抗(一般行駛間的曲道平衡對抗)
  仍然沒有接~~:**2026-07-16 已補上(B3)**——`PlayScene.jsx` 隨機
  20~34 秒觸發一次「列車進入彎道」平衡對抗事件,跟 `BossScene.jsx` 的
  50%/30% 血量門檻閘門共用同一套 `config/balanceGate.js` 純物理,這是
  該共用模組原本就設計好的第三個呼叫端(見 `config/balanceGate.js`
  開頭註解),只是這次才真的接線。完美完成 +20 穩定度,4 秒沒完成按比例
  扣穩定度,完全零操作額外觸發 1.5 秒「一般失衡」樂器 lockout(跟 miss
  打到 0 觸發的「嚴重失衡」共用同一組欄位,新增 `gameEngine.js` 的
  `triggerImbalance(durationMs, nowMs)` 公開入口)。手機陀螺儀輸入不在
  這次範圍,只接鍵盤/自訂 `balanceKeys`。
- **`SongSelectScene`/`StageMapScene` 沒有接 `assets/songs.json` 動態
  曲目清單、沒有試聽播放**:前者固定用 `DEFAULT_TRACKS`,後者沒有播放
  原始碼點歌時的 `new Audio()` 循環試聽,詳見兩個檔案開頭註解。
- **選站後沒有真正的進站小遊戲/肉鴿卡三選一**:`StageMapScene` 選站直接
  進 `PlayScene`,跳過原始碼 `arrival` phase 的畫面流程——`PlayScene.jsx`/
  `BossScene.jsx` 2026-07-15r 各自有一個「🎴 抽卡(demo)」按鈕模擬三選一
  機制本身(抽卡池排除規則/選卡套用效果都是真的),但不是掛在
  `arrival` phase 或站與站之間的自動觸發,是手動demo 觸發,詳見下方
  2026-07-15r 章節。
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

## 2026-07-15q:素材本體搬入 + 2026-07-15r:道具/肉鴿卡接線

使用者接著選了「1 跟 2 都做」(搬入美術/音訊素材 + 接道具/肉鴿卡系統)。

- **素材搬入**:`web-build/assets/` 158 個檔案本體已經複製進
  `public/assets/`,BOSS/選歌的 chart 驅動模式現在真的能 fetch 到資料,
  詳見 `systems/assets/README.md`。
- **道具/肉鴿卡**:新增 `judge/rogue.js`(`recalcRogue()`,19 張卡完整
  數值效果)+ `judge/items.js`(`ItemManager`,4 種道具充能/必殺技集氣)+
  `gameEngine.js` 新增 `addStability()` 公開方法,詳見 `judge/README.md`
  2026-07-15r 章節。
  - `PlayScene.jsx`:1/2/3/4 鍵 + 畫面按鈕啟用道具,「🎴 抽卡(demo)」
    按鈕模擬進站三選一,`npcExtra`/`noteRateMult`/`refillCount`/
    `regenPhone`/`prioritySeat` 全部接進 tick 迴圈。
  - `BossScene.jsx`:也有自己的抽卡 demo,但只有 `bossDmgMult`
    (finalsprint 卡)真的有作用——這個場景是獨立 demo,沒有道具系統跟
    其他數值效果的呼叫端,`npcExtra`/`refillCount` 等欄位在這裡不適用
    (BOSS 戰沒有一般 NPC,也沒有站務員事件)。
  - 沙箱驗證:`npm run build`(92 modules)+ 既有 9 支測試回歸全過 +
    新增 `test-items-rogue.mjs`(64 項斷言),累計 326 項斷言全綠。
  - ⚠️ **完全沒有經過瀏覽器實測**:道具按鈕/抽卡按鈕的實際操作手感、
    必殺技清屏效果、19 張卡各自數值影響玩起來感覺對不對,都需要你本機
    瀏覽器實測確認。

## 2026-07-15s:補上 BossScene.jsx 漏接的道具系統(使用者實測發現)

使用者玩過後問「boss 對戰場沒道具是合理的嗎」——不合理,這是遺漏,不是
刻意設計。`judge/items.js` 開頭本來就寫明道具在 BOSS 戰有專屬效果(耳機
變傷害護盾、墨鏡讓彈幕變慢、空車票瞬間清彈幕),但上一輪(15r)只顧著
把肉鴿卡接進 `BossScene.jsx`,忘記真的把 `ItemManager` 也接進去。已補上
四種道具的 BOSS 分支效果,詳見 `boss/README.md` 2026-07-15s 章節。

## 2026-07-15u:整個選單/流程介面(App.jsx 換成真正的遊戲入口)

> 使用者確認「還有什麼沒做但工作量大的」後選了「整個選單/流程介面」,
> 分批方式選「全部一次做完」,`App.jsx` 定位選「換成真的入口」——這輪把
> 之前只做出核心玩法場景(判定測試場/BOSS 戰/選曲/通勤路線圖)的
> `web-build-next`,補上原始碼 `web-build/index.html` 剩下的 15 個選單/
> 流程畫面,並把 `App.jsx` 從「搬移驗證清單」demo 頁換成真正從 splash
> 開始、可以整場走完的選單導向遊戲入口(demo 清單整份拿掉)。

**新增 `systems/game/` 檔案**(逐字對照原始碼行號,見各檔案開頭註解):
`MenuLayout.jsx`(共用外殼:背景圖+遮罩+標題+返回按鈕,給下面大部分
清單型畫面共用)、`SplashScene.jsx`(4162-4175)、`HubScene.jsx`
(4184-4224)、`LobbyScene.jsx`(4357-4374)、`ModeScene.jsx`(4501-4525)、
`SlotsScene.jsx`(4527-4572)、`BossSelectScene.jsx`(4574-4599)、
`ArrivalScene.jsx`(5407-5552,肉鴿卡三選一到站畫面)、`CalibrateScene.jsx`
(4477-4499)、`SettingsScene.jsx`(4376-4475)、`RecordsScene.jsx`
(4226-4273)、`NewsScene.jsx`(4317-4334)、`LeaderboardScene.jsx`
(4336-4355)、`VendingScene.jsx`(4275-4315)、`ResultScene.jsx`(一般結算,
5629-5664)、`BossResultScene.jsx`(BOSS 結算,5554-5628)、
`ResultBreakdown.jsx`(兩個結算畫面共用的判定分佈四色條,對照原始碼
`ResultStats`)。

**`PlayScene.jsx`/`BossScene.jsx` 新增的接線用 prop**(純新增,沒傳這些
prop 時行為完全不變):
- `onFinished(stats)`:曲目播完(`PlayScene`)/討伐成功或死亡後放棄
  (`BossScene`)時呼叫一次,吃 `engine.getState()`(score/combo/maxCombo/
  stability/counts 齊全)+ 額外欄位(`stationIndex`/`gameMode`/
  `outcome`/`bossId`),給 `App.jsx` 導向 arrival/result 畫面用。
- `initialRogueCardIds`:通勤模式在到站畫面選的肉鴿卡(對照原始碼整趟
  通勤延續的 `runCardsRef`)現在會真的透過這個 prop 帶進下一站/終點
  BOSS 戰,不再是每個場景各自從空清單重新開始——這是這輪額外補上的一個
  真接線(先前 `PlayScene.jsx`/`BossScene.jsx` 各自的「🎴 抽卡demo」是
  獨立、不延續的,現在跟 `ArrivalScene` 選的卡是同一份清單)。

**`config/constants.js`/`save/save.js` 新增**:`DEFAULT_LANE_KEYS`/
`DEFAULT_BALANCE_KEYS`/`BALANCE_DIR_LABEL`(補搬 2026-07-14i 電腦板自訂
快捷鍵功能的常數,之前只改了正式版)+ `defaultSave().settings` 補
`laneKeys`/`balanceKeys` 欄位,給 `SettingsScene.jsx` 用。

**`App.jsx` 整個換掉**:不再是系統檢查清單 + 各系統獨立展示按鈕,改成
用 `switch(screen)` driven 的真實流程控制器,從 `splash` 開始,串起
`hub → lobby → mode →`(通勤:`slots → stagemap → playing → arrival →`
下一站或終點 boss;自由:`songselect → playing → result`;BOSS 測試:
`bossselect → boss → result`)+ hub 的 `records`/`news`/`leaderboard`/
`settings(→calibrate)`/`vending`/練習模式。

**⚠️ 刻意的範圍邊界(規模最大的一次接線,詳見各檔案開頭註解)**:
- **到站後「繼續共GO」是回到通勤路線圖**,不是像原始碼直接無縫接下一站
  ——省下額外的「站序自動推進」狀態管理,玩家一樣要點一次下一站,只是
  多經過路線圖畫面一次。
- **`ArrivalScene` 的三選一是直排清單,不是原始碼的 scroll-snap
  carousel**(置中放大/側邊縮小/左右滑動),互動手勢改成點選,選擇邏輯
  (排除已選卡、重抽扣 30 點、繼續前可改選)完全對照原始碼。
- **進站補給預購(`preorder`)、道具/必殺技集氣充能沒有跨站延續**——
  `ItemManager` 目前每次進 `PlayScene`/`BossScene` 都重新歸零,只有肉鴿
  卡效果(`recalcRogue` 算出的加成)做到跨站延續。
- **練習模式/BOSS 戰測試略過陀螺儀權限詢問彈窗**(`askTiltThen`)——手機
  板體感相關功能本來就還沒實作,詳見 `HubScene.jsx`/`BossSelectScene.jsx`
  開頭註解。
- **自訂快捷鍵設定寫得進去但判定邏輯還沒接線讀**,見上面 config 段落。
- **BOSS 結算畫面沒有「查看得分明細」展開區塊**——需要 `BossScene.jsx`
  額外收集通關時間/事件分項統計,目前只有 `engine.getState()` 既有的
  counts/maxCombo/score/stability,詳見 `BossResultScene.jsx` 開頭註解。
- **分享成績卡(canvas 截圖)兩個結算畫面都沒有做**。
- **`SplashScene` 沒有做原始碼獨立的 `menu` phase**(4177-4182,一個內容
  幾乎重複的過渡畫面),`splash` 點擊直接進 `hub`。
- 一律沒有做手機陀螺儀/傾斜輸入,詳見上方各點。

**驗證**:沙箱 `npm run build`(107 modules)通過(輸出目錄 `dist/` 這次
被 Windows 端鎖住幾個檔案沒辦法 `rimraf`,改用 `--outDir` 指向沙箱暫存
路徑驗證編譯結果,純粹是沙箱環境的檔案鎖問題,不是程式碼有錯——本機
`npm run dev`/`npm run build` 應該不會遇到這個);既有 10 支測試(330
項斷言)全數回歸通過。**這輪新增的畫面全部是 `.jsx` 檔案,沒有對應的
node 測試腳本能驗證「真的能不能玩」,完全沒有經過瀏覽器實測**,尤其
下面這幾點要重點確認:
- 從 splash 點「開始通勤」整路走到 hub,7 個設施卡片都能正常進入對應
  畫面,返回按鈕都能正常回到上一頁。
- 通勤模式整路走一次:mode → slots(選一格)→ stagemap(選第 1 站)→
  playing(打完一首)→ arrival(選一張肉鴿卡,或按重抽)→ 繼續共GO →
  回到 stagemap 確認第 1 站打勾、第 2 站解鎖。
- 自由模式:mode → songselect → playing → result → 重新挑戰/回月台。
- BOSS 戰測試:mode → bossselect → boss → 打贏/打輸都能正確進
  `BossResultScene`,「回月台」能回到 hub。
- 行控中心:調音量/開關/自訂快捷鍵(綁鍵、Esc 取消、重複鍵擋下、重設
  預設)、進即時校準點「打!」幾次套用 offset、改名、清除存檔。
- 乘車紀錄/旅客資訊/營運看板/自動販賣機(哩程不足擋下購買、預購後按鈕
  變已預購)。

## 2026-07-16 第二輪:肉鴿卡插圖 + BOSS 攻擊特效/彈幕真圖 + yaksha fallback + StageMapScene 素材 + Canvas 渲染切片

> 接續同一天早些的 A 類第一輪(車廂背景/五軌底紋/音符/道具 icon/BOSS
> 立繪+背景/選曲背景),使用者確認「還有什麼沒作」後選了「那就都作」
> ——把 A 類盤點時列出的剩餘缺口(肉鴿卡插圖孤兒檔案/BOSS 彈幕跟攻擊
> 特效仍是純色塊/yaksha 缺立繪/StageMapScene 沒套用素材)+ D 類架構債
> (game loop 完全脫離 React 渲染)的第一個實質切片一次做完。

**肉鴿卡插圖 manifest 化**:`assets/art.js` 新增 `cardArt(id)` 函式
(`` `assets/card-${id}.png` ``)——`public/assets/` 早就有 19 張
`card-*.png`,檔名跟 `data/rogue.js` `ROGUE_CARDS[].id` 逐字對應,只是
`ART` 物件從來沒有收錄入口。`PlayScene.jsx`/`BossScene.jsx` 的「抽到 3
張肉鴿卡」Dialog 都改成 `<img src={cardArt(card.id)}>` + 文字兩欄排版
(取代純 emoji + 一行文字)。

**BOSS 攻擊特效疊圖**(`BossScene.jsx`):新增 `specialFxRef`,BOSS 使用
特殊招式(訊號干擾/口水噴濺)瞬間疊一張對應圖(`ART.bossSignal`/
`ART.bossSpit`),顯示 700ms 後自動消失,跟已有的 `showNotice()` 文字
提示/`bossSkill` 鏡頭效果同一個觸發時機。公事包長按 QTE 疊層也加上
`ART.bossCase` icon 取代單靠 💼 emoji。

**BOSS 彈幕本體套用真圖**:查證過 `assets/boss-bullet.png` 的檔案本體
（用 Pillow 檢查 alpha channel)已經是處理好去背的成品(四角 alpha=0,
彈幕本體不透明無殘留洋紅邊緣)——`art.js` 原本「洋紅底,載入時即時去背」
的註解描述的是**原始素材**(去背前)的狀態,不是搬進 `public/assets/`
後這個檔案的狀態,不需要額外寫任何去背程式碼,已更新 `art.js` 該欄位
的註解澄清這點。

**yaksha 缺立繪 fallback**:`BossScene.jsx` 新增 `portraitBroken` state
+ 立繪 `<img onError={() => setPortraitBroken(true)}>`——`yaksha`(擴音
夜叉)目前只有橫幅(`banner`)跟 BGM,沒有 P1/P2/P3/開場立繪檔案,載入
失敗會退回 `bossDef.banner`,banner 也沒有的話最後退回 `ART.boss`(紅線
立繪)保底,只失敗一次就固定用備用圖,不會每次 phase 切換又重新嘗試
載入已知會壞的路徑。這是美術產出缺口(缺檔案),不是接線邏輯的 bug。

**`StageMapScene.jsx` 素材套用**:背景改用 `ART.stagemapBg`,對照
`MenuLayout.jsx` 既有的絕對定位滿版背景圖 + 深色漸層疊層寫法;
`ART.routeMap`(捷運路網圖)盤點時找不到清楚的「一張圖對應一個具體 UI
元素」映射(不是每一站都有自己的路網子圖,這張是整條線的全覽圖),刻意
只當成站點清單上方的裝飾性半透明橫幅使用,不去猜哪一站對應圖上哪個
位置,避免瞎套用出錯誤資訊。

**D 類架構債第一個實質切片:PlayScene/BossScene 判定場/彈幕場改用
Canvas 渲染**:兩個場景「軌道底色/音符或彈幕/炸彈/雜訊」這塊——原本
每幀用 `viewRef.current.notes/bombs/noise`(`PlayScene`)或
`viewRef.current.bullets`(`BossScene`)餵給 JSX `.map()`,每一顆都是一
個真的 React DOM 節點,60fps 判定場/彈幕場常態同時有 10+ 顆在畫面上,
等於每秒讓 React 重新 diff 幾百個節點——改成一張 `<canvas>` 每幀直接用
`ctx.clearRect()+drawImage()` 畫,不再產生任何 DOM 節點,新增
`canvasRef`/`imgCacheRef`(圖片快取,避免每幀重新 `new Image()`)/
`drawField()`(`PlayScene.jsx`)或 `drawBossField()`(`BossScene.jsx`)。
渲染邏輯逐一還原原本 JSX 版本的視覺(色塊/發光陰影/圖片疊圖,圖片沒
載入好就只顯示色塊/發光當後備,不會因為圖片還沒下載完就整顆消失看不到
判定位置),判定邏輯/資料來源(`notesRef`/`npcRef`/`bulletsRef`)完全
不變,只是渲染手法換了。

- ⚠️ **範圍邊界(刻意只框在這塊,不是完整重構)**:`ParticleLayer.jsx`/
  `LightingLayer.jsx`/`effect/FxLayer.jsx`(各自獨立的既有系統,本身已經
  是「manager 塞在 ref + tick counter 逼重繪」模式,不是這次架構債指名
  的負擔來源)、鏡頭/震動 transform(本來就只是一個 style 物件)、HUD
  面板/攻擊特效疊圖/QTE/平衡對抗閘門疊層(低頻/瞬時,不是「每幀持續
  變動、數量會累積」的那一層)都刻意維持原樣不動。這不是完整的「game
  loop 完全脫離 React」重構(那需要整個場景換成 Canvas/WebGL,是更大的
  另一個工程),是「React 每幀重繪負擔最大的那一塊」的第一個實質切片。
- canvas 沒有 CSS `backgroundBlendMode:"overlay"` 的一比一等價寫法,
  `PlayScene.jsx` 五軌底紋疊圖簡化成降低透明度疊加,視覺效果接近但不是
  逐 pixel 相同,可接受的近似。

**驗證**:沙箱 `npm run build`(107 modules)通過;既有全部 14 支測試
(`test-b1-keybind-verify`/`test-b3-balance-verify`/`test-boss`/
`test-camera`/`test-evalrun`/`test-items-rogue`/`test-judge-parity`/
`test-miss-wiring`/`test-npc`/`test-particle`/`test-preorder-verify`/
`test-scene`/`test-songselect`/`test-ui`)全數回歸通過,零失敗——這次
改動全部是渲染層(JSX ↔ canvas 2D API),沒有動到任何判定/資料邏輯,
預期不會有回歸,結果也確實如此。**兩個場景都是 `.jsx` 檔案,Canvas
渲染的實際視覺效果(音符/彈幕位置對不對、色塊/圖片疊圖看起來對不對、
效能是否真的比之前流暢)完全沒有經過瀏覽器實測**,務必本機
`npm run dev` 實際玩一輪判定測試場跟 BOSS 對戰場確認。
