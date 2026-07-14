# audio

統一音訊管理,取代目前分散在各處的 `new Audio()`/`bgmElRef`/`menuBgmRef`/
`ensureAudio()`/`beepGate()` 呼叫。分類:BGM / SE / Voice / Ambient /
Announcement,支援音量控制、ducking(暫時壓低)、跨曲同步播放。

## 狀態:Phase 2 完成(2026-07-14)

已搬過來、逐字保留行為的部分:

- `context.js`:AudioContext 單例 + `resumeThenRun()`(修復刷票口嗶聲偶爾
  消失那個 bug 的「resume-before-schedule」保護,原本第 3664-3669 行)。
- `bgm.js`:`SingleAudioChannel` 類別,收斂原本 bgmElRef/menuBgmRef/previewRef
  三份幾乎一樣的 `new Audio()` 樣板。**遊戲頻道跟選單頻道刻意是兩個獨立
  實例,不共用同一顆 `<audio>`**——這是原始碼的刻意設計(避免關卡曲/BOSS曲/
  結算曲互相重疊),移植時完整保留。
- `se.js`:`playGateBeep()`(刷票口嗶聲,逐字保留 resume 修法)+ 兩個泛化過的
  合成音效原語 `playEnvelopedTone()`/`playNoiseBurst()`。
- `ambient.js`:車廂行駛環境底噪(白噪音 + lowpass filter,依行車狀態調整)。
- `volume.js`:**新增**的音量分類模型(master × category × duck),原始碼沒有
  這層,是規格書要求的 ducking 能力。
- `manager.js`:`AudioManager` 統一介面,`isMenuBgmSilentPhase()` 逐字保留
  原本第 3532/3545 行「哪些 phase 選單曲要靜音」的判斷。

## 這次刻意沒搬的部分

原始碼第 899-1270 行左右有一整批具名合成音效函式(`playBump`/`playChime`/
`playDoorOpen`/判定命中音效...),全部呼叫端(判定/BOSS/進站門片動畫)都在
Judge/Boss/Scene 系統裡,那些系統要 Phase 3 之後才會搬進來。現在搬這些函式
只會變成沒有呼叫端的孤兒程式碼,沒辦法真的驗證接線對不對,所以留到 Phase 3
跟 Judge/Boss 邏輯一起搬,到時候直接用 `se.js` 的 `playEnvelopedTone()`/
`playNoiseBurst()` 重寫,不用再各自複製一份 oscillator 樣板。

## 驗證方式

沙箱裡沒有真的瀏覽器/喇叭,`ctx`/`Audio` 在 Node 環境下都是 `undefined`,
所有方法都有防呆(靜默不做事,不會噴錯)。純邏輯部分(`VolumeModel` 的
master×category×duck 算法、`isMenuBgmSilentPhase()`、`CATEGORIES` 清單)
已用 node 測試腳本驗證。**實際「聽得到聲音」這件事沒辦法在這裡驗證**,
Phase 3 把 Judge/Boss 接上來、你本機瀏覽器測試時才能真正聽到差異。
