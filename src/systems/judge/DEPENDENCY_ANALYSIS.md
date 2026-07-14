# judgeLane / registerHit 依賴分析(Phase 3 設計階段,尚未實作)

來源:`web-build/index.html` `judgeLane`(1726-1837 行)、`registerHit`
(1656-1724 行),以及被它們呼叫的輔助函式 `getBeatTime`(1529）、
`addFloater`(1544）、`flashLane`(1549）、`emitLaneBurst`(1554）、
`applyStabilityDelta`(1582）、`triggerSevereImbalance`(1597）、
`maybeDismissNpc`(1611）。這是全專案耦合度最高的一段,下面列出**每一個**
外部依賴,分四類。這份清單是設計 `judgeLogic(input, context, callbacks)`
的依據,尚未動到 `web-build/index.html` 一行程式碼。

## 1. 輸入資料(input——每次呼叫都會變的東西)

- `laneIdx`——玩家按的軌道(0~4)
- `beatClockRef.current` / `getBeatTime()` 算出來的當下判定時間 `t`
- `notesRef.current`——目前場上音符陣列(含雙軌 `kind:"double"`)
- `bombsRef.current`——假音符(炸彈)陣列
- `noiseRef.current`——雜訊音符陣列
- `phase`——`"running" | "boss" | 其他`(決定走哪個分支)

## 2. 純配置常數(context 的「靜態」部分——整場遊戲不變)

- `WINDOW_PERFECT`(0.05）/`WINDOW_GREAT`(0.10）/`WINDOW_GOOD`(0.15）
- `LANES`(軌道定義,取 `.key`)
- `JUDGE_LABEL`(判定文字)
- `COMBO_MILESTONES`(50/100/200/300)、`multiplierFor(combo)` 用的
  `COMBO_TIERS`(combo 分數倍率表)
- `BACKPACK_SCORE`(300）/`NOISE_SCORE`(20)
- 判分基礎分數表:perfect=100 / great=60 / good=30(目前寫死在
  `registerHit` 內)

## 3. 「跨呼叫存活」的可變狀態(這是規格書寫的「純配置數據(Ref)」裡最容易
被忽略的部分——它們不是靜態配置,是需要在呼叫之間累積/歸零的判定狀態,
必須整批當成一個顯式的 `judgeState` 物件傳入/傳出,不能真的當成「不變的
context」處理,否則邏輯會壞掉):

| Ref | 用途 | 讀 | 寫 |
|---|---|---|---|
| `imbalanceUntilRef` | 嚴重失衡 lockout 到期時間 | judgeLane 開頭擋輸入 | triggerSevereImbalance 設定 |
| `offsetRef` | 判定延遲校準(使用者可調) | judgeLane 算 t 時扣掉 | 校準流程寫入(不在這兩個函式內) |
| `rogueRef` | 肉鴿卡效果集合(autoPerfect/perfWindowMult/missMult/scoreMult/perfMult/perfectBonus/comboRecover/stabFloor/missStabExtra/headphoneDurMult) | 大量讀取 | 不在這兩個函式內寫入 |
| `itemRefs` | 道具啟用狀態(sunglasses.activeUntil 等) | 判定窗放大用 | 不在這兩個函式內寫入 |
| `buffGoodToPerfectUntilRef` | 警察 buff(Good→Perfect)到期時間 | 判定用 | 不在這兩個函式內寫入 |
| `buffMissImmuneUntilRef` | 列車長 buff(miss 免疫)到期時間 | registerHit 判斷用 | 不在這兩個函式內寫入 |
| `doubleNotePendingRef` | 雙軌音符「已按下哪一邊」暫存表 | judgeLane 讀寫 | judgeLane 讀寫 |
| `perfectStreakRef` / `greatPlusStreakRef` | 連續 perfect/great+ 計數(給 NPC 驅散判斷用) | registerHit/maybeDismissNpc | registerHit 累加或歸零 |
| `comboMilestoneRef` / `visualMilestoneRef` | 已觸發過的 combo 里程碑門檻(避免同門檻重複觸發) | registerHit | registerHit |
| `comboHealRef` | 上次連擊回穩的時間戳(節流用) | registerHit | registerHit |
| `comboRef` | 目前 combo 數(給 addExpressCharge 用) | registerHit | 不在這兩個函式內寫入(由 setCombo 的 state 同步) |
| `fullComboMissRef` | 累計 miss 次數(Full Combo 判定) | registerHit | registerHit |
| `staffActiveRef` | 站務員事件是否進行中 | registerHit(miss 時標記失敗) | registerHit |
| `bossComboRef` | BOSS 戰專用 combo(倍率門檻 10/20) | judgeLane(boss 分支) | 不在這兩個函式內寫入 |
| `bombsRef` / `noiseRef` / `notesRef` | 場上音符資料(見上,同時也是輸入也是可變狀態) | 判定+移除 | setNotes/setBombs/setNoise |
| `npcsRef` / `backpacksRef` | NPC/背包客清單 | maybeDismissNpc | setNpcs/setBackpacks |
| `noiseAttackCountRef` / `resolvedNpcCountRef` / `boardingRef` | NPC 驅散判斷輔助計數 | maybeDismissNpc | maybeDismissNpc |
| `practiceRef` | 是否為練習模式(負穩定不扣) | applyStabilityDelta | 不在這兩個函式內寫入 |
| `penaltyLockRef` / `imbalanceKindRef` | 嚴重失衡狀態機 | applyStabilityDelta/triggerSevereImbalance | triggerSevereImbalance |
| `laneHoldTimersRef` | 空軌按住計時器 | stopLaneHold | stopLaneHold |

**共計 33 個不同的 ref**,其中至少 20 個在判定當下被「讀」也會在同一次
判定內被「寫」——這代表判定邏輯本身就是有狀態的(stateful),不是單純的
數學函式,`judgeLogic` 必須明確接收＋回傳這份狀態,不能假裝它是唯讀 context。

## 4. React setState(必須變成 callbacks 的部分——UI 副作用)

`setFloaters` `setLaneFlash` `setTapSparks` `setLaneHold` `setStability`
`setImbalanceKind` `setImbalanceRemain` `setBackpacks` `setScore`
`setEventStats` `setDismissFlash` `setRemainingPassengers` `setNpcs`
`setCounts` `setCombo` `setMaxCombo` `setNotes` `setBombs` `setNoise`
——**共 19 個**。

## 5. 其他外部系統呼叫(也必須變成 callbacks,但不是 setState,而是別的
子系統的副作用進入點)

- `playDrum(key, category)`——鼓聲音效(audio 系統,Phase 2 已搬)
- `playComboFanfare()` / `playFilterSweepDown()` 等——音效(audio 系統)
- `vibrate(pattern)`——震動(config 系統已有 `vibrate()`)
- `triggerComboMilestone(tier)`——combo 里程碑視覺特效(可對接 Phase 4 剛
  建好的 `FxManager`/`ScreenShake`)
- `bossApplyHit(category)`——BOSS 傷害/血量系統(尚未搬)
- `addExpressCharge(category, combo)`——必殺技集氣(尚未搬)
- `triggerSevereImbalance()` / `applyStabilityDelta()` / `maybeDismissNpc()`
  ——這三個原本是「helper 函式」,但因為都會呼叫多個 setState + `setTimeout`,
  設計上應該拆成:(a) 判斷要不要觸發的**純邏輯**留在 `judgeLogic` 內,
  (b) 觸發後「怎麼演出」(setTimeout 幾秒後恢復、閃爍幾次)交給呼叫端
  透過 callback 處理,`judgeLogic` 本身不應該呼叫 `setTimeout`。

## 小結

`judgeLane`+`registerHit` 目前是「數學判斷」「狀態更新」「UI 副作用」
三件事縫在一起寫。要抽成 `judgeLogic(input, context, callbacks)`,關鍵
不是把 33 個 ref 原封不動塞進 `context`,而是先把它們分成:

1. 真正不變的靜態設定 → `config`
2. 需要顯式傳入/傳出的可變判定狀態 → 獨立的 `judgeState`(不是 ref,
   是一個純資料物件,呼叫端負責用 ref 存放上一輪回傳的結果)
3. 音效/震動/分數/視覺特效 → `callbacks`

詳細介面設計見同目錄 `judgeLogic.interface.js`。
