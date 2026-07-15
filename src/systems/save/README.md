# save

搬入範圍：`localStorage` 存檔邏輯（key: `rubyexpress.save.v1`）——暱稱、設定、
全域最佳、每站/BOSS 進度、成就、每日任務、統計等的讀取/寫入/預設值合併
（`loadSave`/`writeSave` 這類函式）。

## 狀態：Phase 1 完成(2026-07-14)+ 2026-07-15j 接進 BOSS 復活流程

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
