# save

搬入範圍：`localStorage` 存檔邏輯（key: `rubyexpress.save.v1`）——暱稱、設定、
全域最佳、每站/BOSS 進度、成就、每日任務、統計等的讀取/寫入/預設值合併
（`loadSave`/`writeSave` 這類函式）。

## 狀態：Phase 1 完成(2026-07-14)+ 2026-07-15j/l 接進 BOSS 復活流程 + 通勤路線圖

- ⚠️ 這份文件先前一直沒更新過(一直寫「尚未搬入內容」),但 `save.js`
  其實從 Phase 1 起就有 `emptyRuby`/`emptySlot`/`defaultSave`/`loadSave`/
  `writeSave`/`clearedProgress`/`todayStr` 完整內容——這是文件跟實際進度
  脫節的既有落差,這次順手修正。
- **接線更新**:`game/BossScene.jsx` 的復活流程原本是 demo 版(略過真正
  的哩程扣點),這輪改成真的呼叫 `loadSave()`/`writeSave()`——復活前檢查
  `save.points >= 80`,不夠會顯示「哩程不足」擋下來;復活成功真的扣 80
  點寫回 `localStorage`;討伐 BOSS 成功也會真的用簡化版公式
  (`floor(score/1000) + 50`,原始碼的 `clearedStations` 乘數這裡拿掉,
  因為 `BossScene` 是獨立 demo 場景沒有「已通過幾站」的關卡進度脈絡)
  把哩程加回存檔、累計 `stats.bossKills`。
- **2026-07-15l 新增 `isStationUnlocked(save, i)`**:純函式,判斷紅寶線
  第 i 站(0-indexed)能不能選——第 0 站永遠開放,其餘要 `clearedProgress()`
  算出的已解鎖進度涵蓋到這一站才行,給新增的 `game/StageMapScene.jsx`
  用。同一輪也把 `game/PlayScene.jsx` 接上真正的過關/最佳分數寫回(有給
  `stationIndex` prop 時)。node 測試腳本 `test-songselect.mjs`(18 項
  斷言)涵蓋這個函式跟既有 `clearedProgress()` 的互動,包含既有邏輯的
  一個既定行為特性:`clearedProgress()` 判斷「已解鎖進度」時只看「最後
  一個 `stationCleared` 為 true 的索引」,不是真的檢查中間有沒有斷開
  (例如站 0/2 過關但站 1 沒過關,仍會判定站 3 也解鎖)——這是 Phase 1
  逐字搬過來的既有行為,這次沒有「修正」它,只是照實測試記錄下來。
- **⚠️ 2026-07-15p 修正的 bug(使用者實測抓到)**:`game/PlayScene.jsx`
  過關寫存檔那段原本只改了 `save.routes.ruby`(過關狀態/最佳分數),但
  `loadSave()` 既有的合併邏輯(Phase 1 逐字搬過來的 #3 存檔格機制)只要
  `save.slots` 陣列存在,`routes.ruby` 就一律被視為「使用中存檔格」
  (`slots[activeSlot].ruby`)的唯讀鏡像——下次 `loadSave()` 會直接拿
  `slots[activeSlot].ruby` 蓋掉 `routes.ruby`,只改鏡像欄位等於白寫,
  這正是使用者實測回報「過關後離開再進通勤路線圖,沒有打勾、下一站也
  沒解鎖」的根因。真正該寫的是 `save.slots[save.activeSlot].ruby`,
  `PlayScene.jsx` 已改成兩個欄位都更新(鏡像欄位同步更新,避免同一次
  render 有地方直接讀 `routes.ruby` 拿到舊值)。`test-songselect.mjs`
  新增完整的 `writeSave()`→`loadSave()` 來回測試(含一組「只改鏡像欄位
  會被蓋回去」的對照組,記錄這個曾經發生過的 bug)。
