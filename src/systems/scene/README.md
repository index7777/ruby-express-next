# scene

搬入範圍（新建）：Scene Manager，管理 Logo / Title / Main Menu / Song Select /
Gameplay / Boss Battle / Result / Settings，每個 Scene 有 `onEnter()` /
`onUpdate()` / `onExit()` 生命週期，取代現有直接改一大堆 `phase` state 的切換
方式。

## 狀態：Phase 5 完成（建立系統，尚未接線）

- `sceneManager.js`：`SceneManager` 類別 —— `register(name, {onEnter,
  onUpdate, onExit})` 註冊場景、`goto(name, data)` 切換（先呼叫舊場景的
  `onExit(data)`，再呼叫新場景的 `onEnter(data)`）、`back(data, fallback)`
  回到上一個場景（history 堆疊）、`update(dt, data)` 轉發給目前場景、
  `clearHistory()` 清空返回堆疊。
- `SCENE_NAMES`：目前 `web-build/index.html` 已知的 phase 字串清單
  （splash/hub/lobby/mode/slots/songselect/bossselect/stagemap/arrival/
  running/penalty/boss/result/calibrate/settings/records/news/
  leaderboard/vending，共 19 個），純粹當對照文件用，`SceneManager` 本身
  不限制場景名稱一定要是這些值。
- 沙箱驗證：`npm run build`（62 modules）+ node 測試腳本
  `test-scene.mjs`（25 項斷言：register/goto 生命週期順序、未註冊場景丟
  錯、重複 goto 同場景不重複觸發、force 強制重跑、data 同時傳給
  exit/enter、history/back()/clearHistory()、update() 轉發）全過。
  `App.jsx` 新增一個可以手動點擊切換場景、看切換紀錄的展示區塊，
  麻煩本機瀏覽器點過確認正常。

## 跟原始碼的差異(刻意設計,不是照抄)

跟 config/save/data/audio(部分)不同,Scene Manager 是**新建的通用基礎
設施**,不是逐行搬移原始碼的 `phase` state 邏輯——原始碼裡 20 個
`setPhase("xxx")` 呼叫散落在各個按鈕/函式裡,每次切換要做的事(例如
`stopBgm()`、`ensureAudio()`、進場動畫的 `setTimeout` 序列)都是手動加在
呼叫附近,沒有統一介面可以逐字對照搬。這裡改成通用的 Enter/Update/Exit
模式,之後真的要接線時,是把「這次切換該做的事」重新組織成對應場景的
`onEnter`/`onExit`,而不是把舊程式碼剪貼過來。

- `back()`/history 堆疊是**新增能力**:原始碼的返回按鈕都是寫死目標
  phase(例如「返回選模式」永遠 `setPhase("mode")`),沒有真正的「上一頁」
  概念。SceneManager 兩種用法都支援,接線時可以先照抄「寫死目標」的用法
  (呼叫 `goto(固定名稱)`),`back()` 留給以後想做真正返回堆疊時再用。
- 場景進場動畫(例如原始碼 splash 畫面的兩段 `setTimeout` 演出)屬於「這個
  場景自己的事」,應該寫在該場景的 `onEnter` 內部自行處理,SceneManager
  本身不管動畫怎麼跑,只負責保證 exit/enter 呼叫順序穩定。

## 這次刻意沒做的部分

- **實際接線**:沒有把 `web-build/index.html` 的 `phase` state 換成
  `SceneManager`,那是後續階段的工作,牽涉到大量既有畫面/按鈕,需要
  另外規劃遷移方式。
- 沒有處理原始碼各個 phase 切換時附帶的副作用(停歌/開音訊/重置某些
  ref)——那些屬於「接線」階段的工作,要對照每個 `setPhase` 呼叫周圍的
  程式碼逐一搬進對應場景的 onEnter/onExit,這裡只確認基礎設施本身正確。
