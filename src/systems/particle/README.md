# particle

搬入範圍：粒子系統——combo 里程碑特效、Perfect/Great 打擊粒子、爆炸/衝擊波等，
獨立於 React render，用 game loop 每幀更新。同一個資料夾也放 Lighting
(動態光源/色調疊層)——BOSS 階段警示、嚴重失衡警戒、combo 光暈，跟原始碼裡
各處各自硬寫的 CSS keyframe 是同一批視覺效果，這裡整理成統一的資料模型。

## 狀態：Phase 7 完成（建立系統，尚未接線）

- `particleManager.js`：`ParticleManager` 類別，維護一個歸還池
  (`_pool`)，粒子死亡後不丟棄物件、清空欄位放回池子，下次 `spawn` 優先
  從池子拿舊物件重填，避免每幀大量 GC（跟 `game/PlayScene.jsx` 開頭註解
  承認「沒有做效能優化」不同，這裡刻意補上）。`emit(x, y, cfg, {rand})`
  依角度/速度範圍噴出 N 顆，`update(dt)` 純數學推進位置/速度/年齡，
  `prune()` 用 swap-pop 就地移除死亡粒子歸還池子，`getActive()` 拿到含
  `life`(1→0)的渲染用快照。
- `presets.js`：`PARTICLE_PRESETS`(comboMilestone/perfectHit/greatHit/
  explosion/trail)+ `emitParticlePreset(pm, name, ...args)`——對照 README
  寫的三類場景的參考設定值，純資料，沒有被任何畫面實際呼叫過。
- `lighting.js`：`LightingManager` 類別，多頻道(channel)設計——BOSS 階段
  警示/嚴重失衡警戒/combo 光暈彼此獨立、互不打斷，同一個 channel 內沿用
  `effect/shake.js` ScreenShake 的「觸發後線性衰減、較強衝擊不會被較弱的
  打斷」模型。`LIGHTING_PRESETS`(bossPhaseAlertP2/bossPhaseAlertP3/
  dangerVignette/comboAura)+ `applyLightingPreset(lighting, name, ...args)`
  對照 `HANDOFF.md` 記錄過的既有演出時機整理，純文件參考。
- `ParticleLayer.jsx`：可重複使用的粒子渲染層，吃一個 `ParticleManager`
  實例自跑 `requestAnimationFrame`(算 dt 餵給 `update()` + `prune()` +
  觸發重繪)，畫面顯示目前存活粒子；跟 `effect/FxLayer.jsx` 刻意做成同樣
  的「傳入 manager + 自跑 rAF + setTick 強制重繪」結構。
- `LightingLayer.jsx`：可重複使用的光效渲染層，吃一個 `LightingManager`
  實例，每幀重新讀 `getAll(now)` 疊出全罩層色塊(`bossPhaseAlert`/
  `dangerVignette` 走暗角畫法，其餘用 `screen` 混合模式的均勻色塊)。
- 沙箱驗證：`npm run build` + node 測試腳本 `test-particle.mjs`(粒子
  物理推進/歸還池復用/存活判斷 + lighting 衰減/多頻道互不打斷/較弱不打斷
  較強規則)全過，既有測試回歸也全過。`App.jsx` 新增一個可以手動觸發各
  preset、即時看粒子噴發跟光效疊層的展示區塊。

## 跟原始碼的差異(刻意設計，不是照抄)

原始碼完全沒有「真的物理位移的粒子系統」——比較接近的是各處各自硬寫的
CSS keyframe/一次性 DOM 特效疊圖，沒有共用的模擬迴圈，也沒有歸還池這類
效能設計。Lighting 同理，原始碼是各個畫面各自寫 CSS 動畫達成類似效果
(BOSS 階段警示紅色掃光、嚴重失衡畫面警示)，沒有共用的「頻道 + 衰減」
資料模型。這裡兩者都是全新建的系統，跟 `web-build/index.html` 現有的
CSS 疊圖是「不同套實作」，不是要取代它——接線之前兩邊互不影響。

## 這次刻意沒做的部分

- **實際接線**：沒有在 combo 里程碑/Perfect·Great 判定/BOSS 死亡/BOSS
  階段門檻/嚴重失衡的實際觸發點呼叫這裡的 preset，`PARTICLE_PRESETS`/
  `LIGHTING_PRESETS` 目前只是文件參考。
- 粒子座標系刻意跟呼叫端的容器約定綁在一起(x/y 是容器內像素座標)，沒有
  自己定義一套獨立座標轉換，接線時容器大小/座標原點要呼叫端自己對齊。
- `LightingLayer` 的「暗角 vs 均勻色塊」分類只是預設猜測，實際接線試玩
  後大概率需要依畫面實際效果調整每個頻道要用哪種畫法。
