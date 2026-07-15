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
- ⚠️ **2026-07-15k 補充**:新增 `rollExtraChartNote()`(P2/P3 依機率
  0.3/0.5 多插一顆額外音符,對照原始碼 2139 行),`BossScene.jsx` 掛載時
  會 fetch 對應 BOSS 的 `.normal.json` 譜面,拿得到就照譜面時間點生彈幕、
  拿不到就退回 `spawnWave()` 備援模式——**但 `web-build/assets/` 還沒搬進
  這個專案,fetch 現在一定會失敗,所以目前實際上永遠走備援模式**,這段
  程式碼是「準備好了」,要等資產搬進來才有得測。復活流程也已經接上真正的
  `save/` 系統(見 `save/README.md`),不再是 demo 假值。

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
  等美術素材疊圖)沒有做——`web-build/assets/` 尚未搬入這個專案(見根目錄
  README「尚未搬入」清單),彈幕/特招目前只回傳「要生在哪個軌道/什麼時間」
  的純資料,視覺渲染留給接線階段一起做。
- ~~chart 驅動模式~~:2026-07-15k 已補上(見上方接線更新),但因為
  `web-build/assets/` 還沒搬進這個專案,實際上永遠會 fetch 失敗、走備援
  模式,等資產搬進來才需要回來真的驗證這條路徑。
- **`holdAttack` 的非 finisher 用法**:原始碼保留了一組非 finisher 文案
  ("這破班誰愛上誰上!長壓接住"),但目前戰鬥中唯一會呼叫 `holdAttack`
  的路徑只有 `triggerBossFinisher`,其他呼叫點已經不存在(公事包已從
  隨機特招池移除)。`BossManager.startHoldAttack()` 保留 `isFinisher`
  參數維持介面彈性,但實際上目前只有 finisher 這條路徑會被用到。
