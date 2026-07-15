# npc

搬入範圍：NPC 行為邏輯——擴音上班族（丟雜訊）、放閃情侶、亂跑小孩（丟炸彈）、
背包客（疊背包逐軌）、站務員、清潔阿姨等進出場與清場規則。

## 狀態：Phase 9 完成 + 2026-07-15j 已接線(`systems/game/PlayScene.jsx`)

- ⚠️ **接線更新**:`NpcManager` 已經接進 `game/PlayScene.jsx`(一般判定
  測試場)——擴音上班族/亂跑小孩/背包客/站務員/捷運警察等會自動抽選出現,
  雜訊/炸彈/雙軌行李箱音符真的會掉下來讓你打,增益效果真的接進
  `gameEngine.js` 的 `setBuffGoodToPerfectUntil`/`setBuffMissImmuneUntil`。
  下面「這次刻意沒做的部分」原本針對 Phase 9(建系統)寫的,「實際接線」
  這條已經不成立,其餘(渲染層/彈幕聊天文字/登車配額)仍然成立,詳見
  `game/README.md`。

- ⚠️ **README 的「6 種」是舊資訊**:`data/npc.js` 的 `NPC_TYPES` 實際上有
  10 種(原本 6 種負向/清場角色 + 後來加的 4 種增益角色:捷運警察/列車長/
  讓座學生,加上原本就在但 README 沒提到的清潔隊員細節)。這次 Phase 9
  一併把完整 10 種都搬進 `npcManager.js`,不是只搬 6 種。
- `npcManager.js`:`NpcManager` 類別,逐字對照原始碼 NPC 系統(2248-2612
  行權重抽選/tick 生成迴圈、1611-1652 行驅散規則、1780-1830 行命中判定
  順序):
  - `rollSpawn()`:權重抽選(對照 2482-2503 行)——同時在場數受
    `npcCap`(依行車狀態,`config/constants.js` 的 `DRIVE_STATES.npcCap`)
    限制,穩定度 <30 時上限 +1、機率 x2;抽選池排除已在場型別、排除跟
    現有增益 NPC 互斥的其他增益型別(`BUFF_NPC_TYPES` 同時只能一種)、
    背包客在平衡事件進行中或讓座學生在場時不抽、以及 `durationMs` 超過
    歌曲剩餘時間的型別不抽。
  - `spawn()`:站務員上場會把其他在場 NPC 實體換掉但保留盤面 hazard(對照
    2508-2539 行修過的 bug——不動雜訊/炸彈/行李箱音符);清潔隊員上場瞬間
    清空雜訊/炸彈/背包疊層並阻擋新負面 3 秒;背包客上場回傳一個
    `gateRequest`(用 `config/balanceGate.js` 建立的平衡對抗閘門,needMs
    900/clashMs 2600,對照 2545-2559 行)供呼叫端接上共用平衡對抗迴圈。
  - `tick()`:擴音上班族每 950ms 丟 1-2 顆雜訊、亂跑小孩每 850ms 丟 1 顆
    炸彈、占位行李客每 1200ms 丟一組雙軌行李箱(直到 `remainSpawn` 歸零轉
    `phase2`),清潔隊員生效期間(`isCleanerBlocking`)暫停雜訊/炸彈生成;
    回傳到期該移除的 NPC id 清單 + 站務員巡查結算(零 miss 才給獎勵)。
  - `canDismiss()`/`dismiss()`:驅散門檻逐字對照 1611-1652 行——擴音上班族
    需要連續 2 個 Great 以上 + 已在場 ≥1.5s + 已丟過 ≥2 次雜訊(保護窗)、
    亂跑小孩需要連續 4 個 Perfect。
  - `popBackpackStack()`:背包客視覺疊層驅散,連續 2 個 Perfect 即可拍掉
    最舊一疊 +300 分(門檻比一般 NPC 驅散低,對照 1613-1622 行),這是跟
    NPC 實體本身驅散**分開**的機制。
  - `hitBomb()`/`hitNoise()`/`hitLuggageDouble()`:對照命中判定順序——
    炸彈是「打中扣分」(实际扣分/combo 重置留給呼叫端的判定系統處理,這裡
    只負責從盤面移除)、雜訊是「打中 +20 分」、雙軌行李箱要兩軌同時按到
    才算 +150 分。
  - `isPoliceActive()`/`isConductorActive()`/`isStudentSeatActive()`/
    `isCleanerBlocking()`:增益效果查詢,純粹依 `active` 清單 + `now` 推導,
    不需要另外維護一堆 `xxxUntilRef`。
- 沙箱驗證:`npm run build` + node 測試腳本 `test-npc.mjs`(涵蓋權重抽選/
  並存上限/互斥過濾/驅散門檻/站務員零 miss 結算/增益效果查詢)全過,既有
  測試回歸也全過。`App.jsx` 新增一個可以手動抽 NPC、看在場清單跟增益狀態
  的展示區塊。

## 跟原始碼的差異(刻意設計，不是照抄)

- 拆成純方法:跟 `boss/bossManager.js` 同樣的 Contract 精神,亂數透過
  `rand` 參數注入,`isLaneFree` 由呼叫端注入而不是自己維護盤面狀態。
- 增益效果改成「查詢 function」而不是「一堆各自獨立的 `xxxUntilRef`」:
  原始碼每種增益(police/conductor/cleaner/student_seat)各自一個
  `useRef` 記錄到期時間,這裡統一從 `active` 清單(NPC 實體本身就記錄了
  `bornAt`/`durationMs`)推導,少一份要保持同步的重複狀態(唯一例外是
  `cleanerBlockUntil`,因為清潔隊員的「阻擋新負面」效果在它自己下場後仍要
  持續一小段時間,不能直接綁在 NPC 實體存活與否上)。

## 這次刻意沒做的部分(Phase 9 建系統當時寫的,接線後仍大多成立)

- ~~實際接線~~:2026-07-15j 已接進 `game/PlayScene.jsx`(見上方接線更新)。
- **NPC 的實際渲染層**(現在是純文字/emoji 佔位,例如 💣/📶,不是美術素材)(對照原始碼 `ART.npc.*` 立繪/彈幕聊天泡泡)沒有
  做——素材尚未搬入這個專案,`tick()`/命中判定只回傳純資料。
- **`DANMAKU_POOL` 彈幕聊天文字**(`data/npc.js` 已經有這份資料)沒有接進
  `NpcManager`——純粹是裝飾性文字,不影響任何判定/分數邏輯,留到接線階段
  再决定怎麼顯示。
- **登車配額(`quota`)/LED「剩餘乘客數」顯示**沒有搬——這牽涉到整首歌
  時長與已生成 NPC 數量的追蹤,屬於接線階段跟 UI 一起處理的範疇,
  `NpcManager` 本身先只管單一 NPC 的生命週期決策。
- **背包客「擠過來」平衡對抗跟一般行駛間曲道平衡對抗的共用狀態**(例如
  `trainBalanceActive` 判斷)由呼叫端在 `rollSpawn()` 的 `ctx` 參數傳入,
  `NpcManager` 本身不持有平衡對抗系統的狀態(那屬於接線階段要決定放在
  哪裡的共用狀態)。
