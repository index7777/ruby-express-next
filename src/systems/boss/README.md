# boss

搬入範圍：BOSS 三階段(P1/P2/P3)、彈幕生成、三種特殊招式、公事包處決 QTE、
50%/30% 血量門檻平衡對抗、BOSS 死亡/復活流程。

## 狀態：Phase 9 完成 + 2026-07-15j 接線 + 2026-07-15k 補 chart 驅動模式/存檔

- ⚠️ **接線更新**:`BossManager` 已經接進新增的 `game/BossScene.jsx`,
  是一個可以按鍵盤打的 BOSS 對戰畫面(彈幕/特招/finisher QTE/平衡對抗
  閘門/死亡復活都真的能玩,不再只是 node 測試的斷言數字)。下面「這次
  刻意沒做的部分」原本針對 Phase 9(建系統)寫的,大多數項目在接線這輪
  仍然成立(實際渲染美術素材仍未做),「實際接線」跟「chart 驅動模式」
  這兩條已經不成立,詳見 `game/README.md`。
- ⚠️ **2026-07-15t 三個使用者實測回報**:
  1. **墨鏡減速沒有效果**——15s 雖然算出了拉長的 `hitTime`,但畫面渲染
     `progress` 計算一直拿固定的 `APPROACH_SEC` 當分母,沒有讀彈幕自己的
     `fallSec`,結果彈幕會在最上方卡住不動一小段時間、再用正常速度掉完
     最後一段,肉眼完全看不出變慢。已修正:`spawnWave()`/
     `specialMoveBullets()` 回傳的每顆彈幕都帶 `fallSec`,`BossScene.jsx`
     塞進畫面陣列時保留這個欄位,渲染時改用 `n.fallSec` 當分母;chart
     驅動模式原本也沒套用(怕跟歌曲節奏對不上),但確認「只調整音符提早
     進入下落範圍的時間點,不動 `hitTime`(判定目標不變)」不會造成節奏
     偏移,這次一併套用。
  2. **空車票清屏沒有扣 BOSS 血量**——查證過原始碼(1857 行)確認這是
     正確行為,不是 bug:`clearcard` 在 BOSS 戰只有 `setNotes([])` 清空
     盤面彈幕 + 音效 + 提示文字,沒有任何傷害邏輯,是純防禦性的「清畫面」
     恐慌按鈕,不是攻擊技(會讓爆炸彈幕造成傷害的是 `express` 必殺技,
     兩者刻意不同)。
  3. **復活後必殺技集氣沒有回滿**——查證過原始碼 `confirmRevive()`
     (3387 行)確認復活獎勵包含「必殺集氣全滿」,`doRevive()` 之前漏接
     這個效果,已補上(`itemsRef.current.expressCharge = EXPRESS_NEED`)。
     另外**確認「重新挑戰」保留道具充能/集氣的行為本來就是對的**——原始碼
     `retryBoss()` 設 `keepItemsRef.current = true` 讓 `startBoss()` 跳過
     道具重置,`BossScene.jsx` 的 `doRetry()` 本來就沒有動
     `itemsRef.current`,跟這個規則一致,不需要修改。
  4. 新增迴歸測試(`test-boss.mjs` 的 `fallSec` 存在性驗證),累計 330
     項斷言全綠。
  5. **✅ 已實機驗證**:墨鏡減速使用者第一次測反應沒效果,追問後確認是
     測試方式誤會——彈幕下降時長生成當下就定好,已經在飛的彈幕不會中途
     變速(對照原始碼同樣行為),改測「按下後新生的彈幕」就確認有變慢;
     復活必殺集氣全滿、重新挑戰保留道具都測過沒問題。
- ⚠️ **2026-07-15s 補上道具在 BOSS 戰的效果**:使用者發現 `BossScene.jsx`
  完全沒有道具按鈕,查證後確認這是遺漏(`judge/items.js` 開頭註解本來就
  寫明「BOSS 戰的道具分支由 BossScene.jsx 自己接」,但這輪只顧著接肉鴿卡,
  忘記真的把 `ItemManager` 接進這個場景)。已補上:headphone→傷害護盾
  (`applyHit()` 的 `selfDmgActive` 參數,miss 不自傷)、sunglasses→彈幕
  減速(`spawnWave()`/`specialMoveBullets()` 的 `slowActive` 參數,
  `specialMoveBullets()` 之前只有 `spawnWave()` 接了這個參數,這次一併
  補上)、clearcard→瞬間清空盤面彈幕、express→必殺技(兩階段都能用,
  每顆爆炸彈幕呼叫一次 `applyHit("perfect")`)。新增 `test-boss.mjs`
  的 `slowActive` 迴歸測試(60 項斷言)。
- ⚠️ **2026-07-15k 補充**:新增 `rollExtraChartNote()`(P2/P3 依機率
  0.3/0.5 多插一顆額外音符,對照原始碼 2139 行),`BossScene.jsx` 掛載時
  會 fetch 對應 BOSS 的 `.normal.json` 譜面,拿得到就照譜面時間點生彈幕、
  拿不到就退回 `spawnWave()` 備援模式。復活流程也已經接上真正的 `save/`
  系統(見 `save/README.md`),不再是 demo 假值。
- ✅ **2026-07-15q 更新:素材已搬入,chart 驅動模式現在真的能用**——
  `web-build/assets/` 的 158 個檔案(含 `boss-bgm-<id>.normal.json` 譜面
  跟對應 mp3)已經搬進 `public/assets/`,`BossScene.jsx` 掛載時的 fetch
  現在真的抓得到資料,不再永遠 fallback 到備援固定間隔模式,詳見
  `assets/README.md`。

- `bossManager.js`：`BossManager` 類別,逐字對照原始碼 BOSS 戰核心邏輯
  (`bossApplyHit`/`spawnBossWave`/`signalAttack`/`spitAttack`/`holdAttack`/
  `triggerBossFinisher`/`startBossGate`/`endBoss`/`askRevive`/
  `confirmRevive`/`retryBoss`,原始碼 2039-2178/3180-3474 行):
  - `applyHit(category, opts)`:傷害公式 `DMG_TABLE[cat] * BOSS_DMG_PER_HIT
    * comboMult * rageMult * rogueDmgMult`,combo>=20 為 1.5 倍/>=10 為 1.2
    倍;hp 降到 `BOSS_FINISHER_HP`(4)以下自動鎖血並回傳
    `finisherTriggered:true`,鎖血期間傷害幾乎打不動(對照原始碼 `hp =
    max(FINISHER_HP, hp - dmg*0.001)`)。
  - `checkPhaseGate()`:hp 跨過 50/30 門檻各觸發一次 `"g50"`/`"g30"`,呼叫端
    收到非 null 就該接著 `startGate()` 啟動平衡對抗、清空盤面彈幕。
  - `spawnWave()`:備援固定間隔彈幕(無 chart 時),P1 單顆、P2 45% 機率雙顆、
    P3 35% 機率三連掃射 + 35% 雙顆 + 30% 單顆。
  - `rollSpecialMove()`/`specialMoveBullets()`:P1 只有「訊號很差啦」,
    P2/P3 額外可能選到「口水噴濺」;signal 用洗牌保證每顆不同軌(對照原始碼
    明確修過的 bug 註解:舊版隨機挑軌會疊出打不完的重複軌道)。
  - `startHoldAttack()`/`tickHold()`/`resolveHold()`:公事包長按 QTE,
    P1/P2 需壓滿 2000ms、P3 需 2400ms,總視窗多 1300ms 緩衝;成功
    (`isFinisher`)解鎖血量歸零觸發死亡,失敗扣 600 分 + 玩家最大 HP 40%
    傷害且鎖血狀態保持(下次命中再觸發,對照原始碼「無限重試直到成功或
    死亡」)。
  - `startGate()`/`advanceGate()`/`resolveGate()`:重用 `config/
    balanceGate.js` 的共用平衡對抗物理,BOSS 閘門門檻是 30%(比一般平衡
    事件的 100% 低很多),達標 +8% 回血 + 按比例得分,未達標按落差扣血。
  - `checkDeath()`/`revive()`/`retry()`:hp<=0 判win、playerHp<=0 判
    lose;復活扣 80 哩程、回滿血、3 秒無敵,若復活時 finisher 還鎖著會
    重新開一次 finisher QTE(對照原始碼同一個 bug-fix 過的行為);
    只能用一次(對照 `bossReviveUsedRef`)。
  - `rollExtraChartNote()`(2026-07-15k 新增):chart 驅動模式專用,P1
    不會插、P2/P3 各自機率(0.3/0.5)+ 延遲(0.05s/0.08s)不同。
- 沙箱驗證：`npm run build` + node 測試腳本 `test-boss.mjs`(涵蓋傷害公式/
  phase 門檻/finisher 鎖血/QTE 成敗/平衡閘門達標未達標/死亡復活/彈幕生成/
  chart 額外插音符機率,共 59 項斷言)全過,既有測試回歸也全過。`App.jsx`
  新增一個可以手動觸發命中/長按/閘門操作、即時看 BOSS 狀態的展示區塊。

## 跟原始碼的差異(刻意設計，不是照抄)

- 拆成純函式/純方法:原始碼的 BOSS 邏輯全部混在單一元件的 `useRef`/
  `useState`/`useEffect` tick 迴圈裡,這裡拆成一個獨立類別,亂數一律透過
  `rand` 參數注入(預設 `Math.random`),方便測試用固定序列重現同一場戰鬥
  ——這是跟 Phase 3 `gameEngine.js`/Phase 6 `cameraManager.js` 同樣的
  「Contract」精神,不是重新設計戰鬥邏輯。
- `spawnWave()` 的「軌道是否空閒」透過 `isLaneFree` 參數注入,不是自己維護
  一份盤面音符清單——原始碼的 `isBusy()` 判斷需要對照真正的 `notes`/
  `noise`/`bombs` 陣列,那些盤面狀態應該由呼叫端(之後接線時)持有,
  `BossManager` 本身只管「這次要生哪幾顆、生在哪」的決策邏輯。
- 修正了 `config/README.md` 一直沒同步的落差:`BOSS_FINISHER_*` 常數
  README 早就寫了要搬,但 Phase 1 其實漏搬,這次 Phase 9 一併補上(見
  `config/constants.js`/`config/README.md`)。

## 這次刻意沒做的部分(Phase 9 建系統當時寫的,接線後仍大多成立)

- ~~實際接線~~:2026-07-15j 已接進 `game/BossScene.jsx`(見上方接線更新),
  這條已經不成立,保留刪除線是方便對照這份文件的演進過程。
- **BOSS 撞擊/入場演出、彈幕的實際渲染層**(對照原始碼 `ART.bossSignal`
  等美術素材疊圖)沒有做——素材檔案本體雖然 2026-07-15q 已經搬進
  `public/assets/`,但 `BossScene.jsx` 的彈幕/BOSS 本體目前還是畫成純色
  塊,還沒有改成 `<img src={ART.xxx}>` 真的套用這些素材,這是額外一輪
  視覺套用工程,見 `assets/README.md`「這次刻意沒做的部分」。
- ~~chart 驅動模式~~:2026-07-15k 已補上(見上方接線更新),2026-07-15q
  素材搬入後已經真的能 fetch 到資料,不再永遠 fallback。
- **`holdAttack` 的非 finisher 用法**:原始碼保留了一組非 finisher 文案
  ("這破班誰愛上誰上!長壓接住"),但目前戰鬥中唯一會呼叫 `holdAttack`
  的路徑只有 `triggerBossFinisher`,其他呼叫點已經不存在(公事包已從
  隨機特招池移除)。`BossManager.startHoldAttack()` 保留 `isFinisher`
  參數維持介面彈性,但實際上目前只有 finisher 這條路徑會被用到。
