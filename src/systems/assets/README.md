# assets

搬入範圍：素材路徑對照表（原本的 `ART` 物件），統一管理所有圖片/音檔的路徑與
fallback 邏輯（缺圖時退回 emoji 或純 CSS 樣式）。

狀態：尚未搬入內容（Phase 1）。實際素材檔案（166 個檔案，mp3/png/json）留在
`web-build/assets/`，透過相對路徑或 Vite `public/` 目錄引用，不重複複製。
