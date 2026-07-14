# camera

搬入範圍（新建，原本沒有）：非 3D 的「演出相機」——Zoom / Pan / Focus /
Slow Motion。套用時機：BOSS 登場、BOSS 技能、Combo 里程碑、BOSS 死亡。
規則：平常遊戲畫面保持穩定，相機效果不能影響判定手感。

## 狀態：Phase 6 完成（建立系統，尚未接線）

- `cameraManager.js`：`CameraManager` 類別，兩種原語:
  - **持續性(tween)**:`zoomTo(target, durationMs, easing, now)` /
    `panTo(x, y, durationMs, easing, now)` / `focusOn(x, y, ...)`(目前是
    panTo 的別名,等 Scene 系統定案世界座標後才會真的算「置中某點」)——
    移動到新的靜止值,播完就停在那裡,連續呼叫時新 tween 的起點是呼叫當下
    的插值結果,不會瞬間跳回。
  - **一次性(impulse,沿用 Phase 4 `ScreenShake` 的衰減模型)**:
    `punchZoom(delta, durationMs, now)` / `slowMotion(scale, durationMs,
    now)`——觸發後線性衰減回中性值,強度更大的衝擊不會被較弱的打斷。
  - `getState(now)` 一次拿到 `{zoom, x, y, timeScale}`,方便組成 CSS
    transform。`reset(now)` 一次把所有效果打回中性狀態。
- `presets.js`:`CAMERA_PRESETS`(bossEntrance/bossEntranceEnd/bossSkill/
  comboMilestone/bossDeath)+ `applyCameraPreset(camera, name, ...args)`——
  對照 README 寫的四個套用時機的參考用法,純文件/方便呼叫端一行套用,
  沒有被任何畫面實際呼叫過,數值之後接線試玩時大概率要調整。
- 沙箱驗證:`npm run build`(65 modules)+ node 測試腳本
  `test-camera.mjs`(27 項斷言:tween 插值/連續呼叫起點正確/impulse 衰減
  /強弱衝擊互不打斷規則/reset/presets)全過,既有 5 支測試(modules/
  audio/effect/judge-parity/scene)回歸也全過。`App.jsx` 新增一個可以
  手動觸發各個 preset、即時看 zoom/pan/timeScale 數值跟畫面框效果的
  展示區塊。

## 跟原始碼的差異(刻意設計,不是照抄)

原始碼完全沒有鏡頭概念,這是全新建的系統。`timeScale`(慢動作要用的建議
倍率)目前只是算出來的數字,**沒有**接進任何 tick 迴圈——要不要真的拿去
減速判定/動畫,是接線階段的決定,GameEngine 完全不知道這個系統存在,
避免相機效果不小心影響到判定手感(這是 README 本來就明訂的規則)。

## 這次刻意沒做的部分

- **實際接線**:沒有在 BOSS 登場/技能/combo 里程碑/BOSS 死亡的實際觸發點
  呼叫這裡的 preset,`CAMERA_PRESETS` 目前只是文件參考。
- Camera Offset(原本規劃的一部分)沒有獨立做——`panTo`/`focusOn` 已經
  涵蓋「鏡頭偏移到某個位置」的需求,額外的「offset」概念如果之後接線時
  發現不夠用,再回來擴充。
- `getState().timeScale` 只是建議值,真正拿去做「慢動作時判定窗/動畫
  速度也要跟著變慢」需要接線階段仔細設計(要慢的是誰:tick 迴圈?
  CSS 動畫?兩者都要嗎?),這裡刻意不預設答案。
