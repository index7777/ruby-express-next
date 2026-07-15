# camera

搬入範圍（新建，原本沒有）：非 3D 的「演出相機」——Zoom / Pan / Focus /
Slow Motion。套用時機：BOSS 登場、BOSS 技能、Combo 里程碑、BOSS 死亡。
規則：平常遊戲畫面保持穩定，相機效果不能影響判定手感。

## 狀態：Phase 6 完成（建立系統);2026-07-16 起 BOSS 四個套用時機已接線（見下方「跟原始碼的差異」後新增的接線紀錄）

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

## 這次刻意沒做的部分(2026-07-15 當時的狀態)

- ~~實際接線~~——**2026-07-16 已補上**,見下方新段落。
- Camera Offset(原本規劃的一部分)沒有獨立做——`panTo`/`focusOn` 已經
  涵蓋「鏡頭偏移到某個位置」的需求,額外的「offset」概念如果之後接線時
  發現不夠用,再回來擴充。

## 2026-07-16 接線:B2「攝影機 timeScale 依戰況動態調整」

`BossScene.jsx` 補上四個套用時機的實際呼叫(comboMilestone 之前就已經在
`PlayScene.jsx` 接線過,這次是補齊 BOSS 戰那三個 + comboMilestone 沒有的
`bossDeath`):

- **bossEntrance/bossEntranceEnd**:BOSS 戰掛載當下推近鏡頭,900ms 後
  (對齊 preset 自己的 tween 時長)退回正常構圖,呼應「登場演出」節奏。
- **bossSkill**:BOSS 使用特殊招式(訊號干擾/口水噴濺)瞬間觸發短促
  猛推,對照 `BOSS_SPECIAL_INTERVAL_MS` 頻率(5.2~12 秒視階段),不會
  太密集。
- **bossDeath**:討伐成功瞬間觸發(`slowMotion` + `punchZoom`)。刻意
  選在「勝負已經判定之後」觸發,此時 `b.outcome` 已確定,彈幕生成/技能
  觸發都已經停止,`engine.hit()` 也不會再被判定輸入呼叫——slowMotion
  純粹是演出效果,不會有「相機效果影響判定手感」的疑慮。

`getState().timeScale` 這個原本只算出來、從沒被讀過的建議值,這次真的
拿去用:`bossDeath` 觸發當下讀出的 `timeScale`,拿去當「討伐成功」對話框
淡入動畫的時長倍率(倍率越小/慢動作越明顯,淡入就越慢)——純 CSS 進場
動畫,一樣不影響任何判定邏輯,詳見 `game/BossScene.jsx` 的 B2 相關註解。
