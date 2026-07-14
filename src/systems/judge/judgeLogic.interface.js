// judgeLogic 介面設計(Phase 3 設計階段——只有型別/簽章骨架,尚未搬入真正的
// 判定數學,也完全沒有接進 web-build/index.html)。
//
// 目的:把目前縫在一起的 judgeLane()+registerHit()(判定數學 + 33 個 ref
// 讀寫 + 19 個 setState + 一堆音效/震動/特效呼叫)拆成三塊:
//   1. input    —— 這次呼叫才有的東西(按哪一軌、現在幾點、場上音符)
//   2. judgeState —— 需要跨呼叫累積的可變判定狀態(streak/combo里程碑/
//      buff到期時間...),顯式傳入、顯式回傳,呼叫端自己用一個 ref 存著,
//      「judgeLogic 本身不碰任何 React ref/state」。
//   3. callbacks —— 所有音效/震動/分數/視覺特效/NPC/BOSS 副作用,呼叫端
//      決定要接到 setState 還是別的系統(例如 Phase 4 的 FxManager)。
//
// 詳細依賴清單見同目錄 DEPENDENCY_ANALYSIS.md。實際實作見 gameEngine.js。

/**
 * @typedef {Object} NoteLike
 * @property {string} id
 * @property {number} lane
 * @property {number} hitTime        - 秒
 * @property {"normal"|"double"} [kind]
 * @property {number} [doubleLane]   - kind==="double" 時的另一軌
 */

/**
 * @typedef {Object} JudgeInput
 * @property {number} laneIdx          - 玩家按下的軌道(0~4)
 * @property {number} beatTime         - getBeatTime() 算出來、已扣掉校準
 *                                        offset 的判定時間(對應原本的 `t`/`tb`)
 * @property {"running"|"boss"|string} phase
 * @property {NoteLike[]} notes        - notesRef.current
 * @property {NoteLike[]} bombs        - bombsRef.current
 * @property {NoteLike[]} noise        - noiseRef.current
 */

/**
 * @typedef {Object} JudgeConfig  - 純靜態設定,整場遊戲不變,可以直接用常數物件
 * @property {number} windowPerfect    - 0.05
 * @property {number} windowGreat      - 0.10
 * @property {number} windowGood       - 0.15
 * @property {Object} judgeLabel       - JUDGE_LABEL
 * @property {number[]} comboMilestones - COMBO_MILESTONES(視覺里程碑用)
 * @property {(combo:number)=>number} multiplierFor - combo 分數倍率(純函式)
 * @property {{perfect:number, great:number, good:number}} baseScore
 * @property {number} backpackScore
 * @property {number} noiseScore
 * @property {number} autoPerfectWindowSec - 12(先下後上開場自動 Perfect 秒數)
 * @property {number} doubleNoteSimulPressMs - 140(雙軌同時按下容許誤差)
 */

/**
 * @typedef {Object} JudgeState  - 跨呼叫存活的可變判定狀態,呼叫端用一個
 * ref 存著整包物件,每次呼叫 judgeLogic 後用回傳值整個換掉(不可變更新)。
 * @property {number} imbalanceUntil        - 嚴重失衡 lockout 到期時間
 * @property {number} buffMissImmuneUntil   - 列車長 buff 到期時間
 * @property {number} buffGoodToPerfectUntil - 警察 buff 到期時間
 * @property {Object} rogue                 - 肉鴿效果集合(唯讀快照,不在
 *                                             judgeLogic 內修改)
 * @property {Object} items                 - 道具啟用狀態快照(唯讀)
 * @property {Object.<string, Object.<number, number>>} doubleNotePending
 *           - { [noteId]: { [lane]: pressedAtMs } }
 * @property {number} perfectStreak
 * @property {number} greatPlusStreak
 * @property {number} comboMilestone        - 已觸發過的分數里程碑(50/100/500)
 * @property {number} visualMilestone       - 已觸發過的視覺里程碑
 * @property {number} comboHealAt           - 上次連擊回穩時間戳
 * @property {number} combo
 * @property {number} maxCombo
 * @property {number} fullComboMiss
 * @property {boolean} staffMissDuring
 * @property {number} bossCombo
 * @property {boolean} practice
 * @property {boolean} penaltyLock
 * @property {"" | "severe"} imbalanceKind
 */

/**
 * @typedef {Object} JudgeCallbacks  - 所有「這次判定造成的外部影響」都經由
 * 這裡通知呼叫端,judgeLogic 本身不直接呼叫 setState/setTimeout/Audio API。
 * @property {(delta:number) => void} onScoreDelta
 * @property {(category:"perfect"|"great"|"good"|"miss") => void} onCountIncrement
 * @property {(next:number) => void} onComboChange   - 傳新的 combo 值(0=斷連)
 * @property {(delta:number, source?:"miss"|"balance"|"buff") => void} onStabilityDelta
 * @property {(noteId:string) => void} onNoteConsumed
 * @property {(bombId:string) => void} onBombConsumed
 * @property {(noiseId:string) => void} onNoiseConsumed
 * @property {(laneIdx:number, kind:string) => void} onLaneFlash
 * @property {(laneIdx:number, text:string, color:string) => void} onFloater
 * @property {(laneIdx:number) => void} onLaneBurst   - 空軌敲擊粒子(可接 Phase 4 FxManager)
 * @property {(drumKey:string, category:string) => void} onPlayDrum
 * @property {() => void} onPlayComboFanfare
 * @property {(pattern:number|number[]) => void} onVibrate
 * @property {(tier:number) => void} onComboMilestoneFx  - 可接 Phase 4 ScreenShake
 * @property {(category:string) => void} onBossHit       - BOSS 傷害系統(尚未搬)
 * @property {(category:string, combo:number) => void} onExpressCharge  - 必殺技集氣(尚未搬)
 * @property {(kind:"severe") => void} onSevereImbalanceTriggered  - 呼叫端負責
 *           排 setTimeout 2 秒後恢復 + 回穩 20(judgeLogic 只負責判斷「現在
 *           該不該觸發」,不負責排時間)
 * @property {(removedNpcIds:string[], reason:"perfectStreak"|"greatPlusStreak") => void} onNpcDismissed
 * @property {() => void} onDoubleNoteHit  - 雙軌音符雙手命中(+150 分,額外飄字)
 */

/**
 * @typedef {Object} JudgeResult  - judgeLogic 的回傳值,方便測試斷言、也讓
 * 呼叫端知道這次判定「發生了什麼事」,不用自己重新猜。
 * @property {"perfect"|"great"|"good"|"miss"|"none"} category
 *           - "none" = 完全空軌(沒有任何東西可判定,只播鼓聲+粒子)
 * @property {string|null} noteId    - 命中的音符/炸彈/雜訊 id(若有)
 * @property {"note"|"bomb"|"noise"|"double"|"boss-note"|null} targetKind
 * @property {JudgeState} nextState  - 更新後的判定狀態,呼叫端存進 ref
 */
