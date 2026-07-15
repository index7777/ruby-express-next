# judge

搬入範圍：5 軌判定邏輯（Perfect/Great/Good/Miss ±50/100/150ms）、combo 計算、
穩定度、`judgeLane()`、`registerHit()`、`getBeatTime()` 等判定核心函式。

狀態：**GameEngine(Bridge Pattern)實作完成，parity 驗證全過，但完全沒有
接進 `web-build/index.html`**。這是全專案風險最高的一塊，因為 HANDOFF.md
記錄了大量跟時間軸/音樂同步有關的 subtle bug 修正歷史，架構規範定義在
`HANDOFF.md`「⚙️ GameEngine 架構規範(Contract)」一節，這裡只列檔案對應。

## 檔案

- `DEPENDENCY_ANALYSIS.md`：逐行讀過 `judgeLane`(1726-1837)/`registerHit`
  (1656-1724) 及其輔助函式，列出全部依賴——33 個跨呼叫存活的可變 ref、
  19 個 setState、以及 playDrum/vibrate/bossApplyHit/addExpressCharge 等
  外部系統呼叫。
- `judgeLogic.interface.js`：型別設計（JSDoc typedefs：`JudgeInput`/
  `JudgeState`/`JudgeCallbacks`/`JudgeResult`），三段式拆解的參考文件。
- `gameEngine.js`：**真正的實作**。`judgeCore(input, state, callbacks)`
  純函式（禁止 `Date.now()`/`performance.now()`，時間一律由 input 傳入）+
  `createGameEngine(callbacks)` 薄殼（持有自己的判定狀態，不是 React
  state）。涵蓋:失衡 lockout、開場自動 Perfect 鎖輸入、BOSS 分支(墨鏡
  buff 放大窗/警察 buff good→perfect/combo 門檻 10-20 分數倍率)、雙軌
  行李箱音符(140ms 同時按窗)、誤觸炸彈、一般音符三檔判定、雜訊清除、
  完全空軌、combo 分數里程碑(50/100/500 fanfare)+視覺里程碑(50/100/
  200/300)、穩定度增減 + 嚴重失衡狀態機。逐行對照原始碼行號寫註解。
- `legacyReferenceModel.js`：**獨立**轉譯的對照模型(刻意寫成比較貼近
  原始碼單一大函式的樣子,不是 `gameEngine.js` 複製一份),只給
  `test-judge-parity.mjs` 當比對基準用,不是正式程式碼。
- `test-judge-parity.mjs`(專案根目錄)：Trace 記錄器,8 組場景 + 16 項
  斷言,比對 `gameEngine.js`/`legacyReferenceModel.js` 的 callback 呼叫
  序列與最終 score/combo/stability/counts,全數通過。撰寫過程中這個測試
  真的抓到 2 個重構本身引入的順序/邏輯 bug(見下方「抓到的 bug」)。

## 範圍邊界(刻意不做的部分)

- NPC 驅散(`maybeDismissNpc` 的 npcs/backpacks 清單過濾)留給未來 npc
  系統，`gameEngine.js` 只維護 `perfectStreak`/`greatPlusStreak` 兩個
  計數，不碰 npc 資料，避免跟還沒搬的子系統提前耦合。
- BOSS 傷害/連段遞增(`bossApplyHit`/`bossCombo` 怎麼算)留給未來 boss
  系統，`bossCombo` 當成唯讀 input 傳入，分數倍率公式(10/20 門檻)還是
  照抄，因為那是判定分數的一部分。
- 站務員事件狀態(`staffActiveRef.missDuring`)只透過 `onStaffMissDuring`
  通知，不持有站務員事件狀態。
- 嚴重失衡 2 秒後自動恢復，原本是 `setTimeout`——引擎不排時間，只提供
  `recoverFromImbalance(nowMs)` 給呼叫端在計時器到期時呼叫。

## 撰寫 parity 測試時抓到的 2 個 bug

1. `applyStabilityDelta` 內「先觸發嚴重失衡副作用還是先通知穩定度變化」
   的呼叫順序:原始碼是 `setStability((s) => { ...算 next...;
   if (該觸發嚴重失衡) triggerSevereImbalance(); return next; })`，
   `triggerSevereImbalance()` 在 updater 內部同步執行，理應先於「穩定度
   變化」被通知，但第一版 `gameEngine.js` 寫反了。
2. 穩定度算出來的值被 `Math.max(floor, Math.min(100, ...))` 夾住、跟原本
   一樣時，第一版 `gameEngine.js` 加了「值沒變就不通知」的最佳化，但原始
   碼的 `setStability(fn)` 不管值變不變都會呼叫，這個「最佳化」其實是行為
   改變，已拿掉。

## ⚠️ 誠實聲明

`gameEngine.js` 跟 `legacyReferenceModel.js` 都是同一個人(AI)讀
`web-build/index.html` 轉譯出來的，不是瀏覽器實際錄的 trace。parity 測試
保證的是「這次重構有沒有跟另一份獨立轉譯對不上」，抓的是重構動作本身的
行為漂移，不能背書「這就是原始碼的正確行為」——如果我對原始碼本身的理解
有誤，兩份轉譯會錯在同一個地方，測試也抓不出來。**最終還是要你在本機
瀏覽器實測，拿真正的分數/連段數字跟 `web-build/` 現況核對一次**。

## 下一步(需要你確認要不要繼續)

`gameEngine.js` 目前完全獨立、可測試，但沒有任何畫面在用它，也完全沒有
接進 `web-build/index.html`。要不要接線、什麼時候接線、要不要先做一個
`web-build-next` 內的最小可玩判定畫面來手動試手感，都還沒有排程，會再
另外跟你確認。

## 2026-07-15:最小可玩畫面接線(`systems/game/PlayScene.jsx`)

上面「下一步」問題選了「先做一個最小可玩判定畫面」這條路，實作進度：

- **新增 `engine.miss(lane, isChartNote, nowMs)`**：原本 `createGameEngine()`
  只暴露 `hit()`(對應 `judgeLane`)，但原始碼 tick 迴圈還有一條「音符掉出
  判定窗、玩家沒按到」的自動 miss 路徑(`index.html` 2420 行，直接呼叫
  `registerHit(n.lane,"miss",...)`，不經過 `judgeLane`)。這次補上
  `engine.miss()` 直接重用同一份 `registerHit`，行為對齊原始碼。
- **`systems/audio/se.js` 補搬 `playDrum()`/`playComboFanfare()`**：這兩個
  是 Phase 2 audio 搬移時「刻意先不搬」的具名 SFX(因為當時沒有呼叫端)，
  現在 `gameEngine.js` 的 `onPlayDrum`/`onPlayComboFanfare` callback 真的
  要接聲音了，逐字對照原始碼 1269-1313 行/1052-1069 行補上，`AudioManager`
  新增 `playDrum()`/`playComboFanfare()` 方法呼叫它們。
- **範圍邊界(這次刻意只做最小子集，不是完整移植)**：只搬「一般音符」
  判定路徑(`buildChart()` 備援固定節奏，5 軌，Perfect/Great/Good/Miss)，
  **沒有**做雙軌行李箱音符/炸彈/雜訊/BOSS 分支/NPC/道具/肉鴿卡——這些
  在 `judgeCore` 裡邏輯都已經寫好，但這次的 `PlayScene` 只餵最單純的
  一般音符 input，尚未搬對應的 UI/生成邏輯，詳見 `systems/game/README.md`
  跟 `PlayScene.jsx` 內的註解。
- ⚠️ **完全沒有經過瀏覽器實測**，見頂層 HANDOFF.md 對應章節的待驗證清單。
