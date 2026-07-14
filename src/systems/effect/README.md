# effect

FX Library(Perfect/Great/Good/Miss/Explosion/Shockwave/Smoke/Spark/Trail/
Glow)+ 共用 Animation System + 打擊感基礎建設(Screen Shake / Hit Stop)。

## 狀態:Phase 4 完成(建立系統,尚未接線)

- `animations.js`:共用動畫規格表(Fade/Slide/Zoom/Bounce/Shake/Pulse/Flash/
  Rotate/Float 的時長/緩動曲線),取代各處手刻不一致的 setTimeout 秒數。
- `fxManager.js`:`FxManager` 類別,管理一次性特效的生成/過期,取代原本
  `addFloater`/`flashLane`/`emitLaneBurst` 各自一份 setTimeout 樣板。
- `shake.js`:`ScreenShake` 螢幕震動資料模型,Phase 6(Camera 系統)之後
  BOSS 登場等演出也會共用這個模型,不用重做一套。
- `hitstop.js`:`HitStop` 打擊停頓資料模型。
- `FxLayer.jsx`:可重複使用的 React 渲染層,吃一個 `FxManager` 實例自動畫出
  目前存活的特效(用 `requestAnimationFrame` 自己跑迴圈)。

沙箱驗證:`FxManager`/`ScreenShake`/`HitStop` 的純邏輯(spawn/過期時間/
震動衰減/hit stop 判斷)已用 node 測試腳本驗證。`FxLayer` 需要真的瀏覽器
才能看到視覺效果,`App.jsx` 新增了一個可以手動觸發各種特效的展示區塊,
麻煩本機瀏覽器點過確認畫面正常。

## 這次刻意沒做的部分

- **實際接線**:judgeLane/registerHit 命中的時候該呼叫 `fx.spawn(...)`、
  `shake.trigger(...)`、`hitStop.trigger(...)`——這些呼叫點都在 Judge/Game
  Loop 那塊高風險核心程式碼裡,那塊工作已跟你確認暫緩(見對話記錄),
  所以這裡只把「系統本身」建好、測過,還沒有真的接進遊戲判定。
- Camera 完整演出系統(zoom/pan/focus/slowmo)留給 Phase 6,這裡的
  `ScreenShake` 只是震動這一小塊,之後 Phase 6 會直接複用。
