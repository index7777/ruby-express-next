# app

整個遊戲的最外層元件。

## 狀態:2026-07-15 選單流程接線後,已是真正的遊戲入口

`App.jsx` 不再是 Phase 0~9 的「搬移驗證清單」demo 頁(那份 demo 已經整份
移除),改成用 `switch(screen)` 驅動的真實流程控制器,從 `splash` 開始,
串起 hub/lobby/mode/slots/bossselect/stagemap/songselect/playing/boss/
arrival/result/settings/calibrate/records/news/leaderboard/vending 全部
15+ 個畫面(各畫面實作在 `systems/game/`,見該資料夾 README 2026-07-15u
章節的完整清單跟範圍邊界說明)。

沒有另外掛獨立的 Provider/Context——`audio`/`fx`/`shake`/`camera` 四個
manager 在 `App.jsx` 用 `useRef` 建立一次,以 props 往下傳給
`PlayScene`/`BossScene`;`save`(存檔)則是各畫面元件自己在需要時呼叫
`loadSave()`/`writeSave()`(對照原始碼 `saveRef`/`persist()` 直接讀寫
`localStorage` 的做法,沒有集中成一個 Context)。
