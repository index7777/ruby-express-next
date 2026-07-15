# assets

搬入範圍：素材路徑對照表（原本的 `ART` 物件），統一管理所有圖片/音檔的路徑與
fallback 邏輯（缺圖時退回 emoji 或純 CSS 樣式）。

## 狀態：Phase 1 完成(路徑表)+ 2026-07-15q 素材檔案本體已搬入

- ⚠️ 這份文件先前一直沒更新過(一直寫「尚未搬入內容」),但 `art.js` 的
  `ART` 路徑對照表其實從 Phase 1 起就有完整內容——這是文件跟實際進度
  脫節的既有落差。
- **2026-07-15q 更新**:`web-build/assets/` 的 158 個檔案本體(115 張
  png + 23 個 mp3 + 20 個 json 譜面,原本的 162 個扣掉 4 個
  `.magenta-backup` 備份殘留檔沒有搬)已經複製進
  `web-build-next/public/assets/`(Vite 靜態資源慣例路徑,`ART`/
  `data/songs.js` 裡的相對路徑字串 `"assets/xxx"` 不用改,原封不動對
  得上)。
- **這代表什麼**:`boss/README.md`/`game/README.md` 之前都寫「chart
  驅動模式/fetch 一定會失敗,因為素材還沒搬進來」——現在素材搬進來了,
  `BossScene.jsx`(BOSS 專屬歌曲譜面)跟 `PlayScene.jsx`(通勤路線圖選歌
  的真正譜面)這兩個 fetch 都應該真的抓得到資料、換掉備援節奏了。已經
  用 node 腳本驗證過搬過來的 `boss-bgm-redline.normal.json` 格式是
  `{song_metadata:{...}, notes:[{time, lane}, ...]}`(`time` 是秒數),
  跟 `BossScene.jsx`/`PlayScene.jsx` 原本寫的 `n.time`→`hitTime` 對應
  完全吻合,不用改程式碼。

## 這次刻意沒做的部分

- **畫面渲染還是純色塊/emoji,沒有換成真正的圖片**:`PlayScene.jsx`/
  `BossScene.jsx`/`StageMapScene.jsx` 目前的音符/BOSS/NPC 都還是用
  inline style 畫的色塊或 emoji,沒有改成 `<img src={ART.xxx}>`——素材
  檔案「搬進來」跟畫面「真的套用這些素材」是兩件事,後者是更大的一輪
  視覺套用工程(每個場景的每個元素都要對照 `ART` 表個別接),這次只確保
  chart JSON/mp3 這類「遊戲邏輯要讀取的資料」搬過來且路徑對得上,圖片類
  素材的實際套用留到之後排。
- **`manifest.webmanifest`**(PWA 設定檔)沒有搬,不影響遊戲本身能不能玩。
- 4 個 `.magenta-backup` 殘留檔(疑似圖片去背處理的備份,不是任何程式碼
  會讀取的路徑)沒有搬,只搬了 158 個真正會被程式碼引用到的檔案。
