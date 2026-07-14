# game

搬入範圍：主遊戲迴圈（tick），把目前綁在 React `useEffect`/`useRef`裡的每幀
更新邏輯（音符生成/下落、beatClockRef、NPC tick、BOSS tick）抽成獨立、非
React state 驅動的 game loop，React 只負責讀取 loop 狀態來 render UI，減少
不必要的重繪，對應規格書「效能」要求。

狀態：尚未實作（Phase 3，屬於高風險核心，需搭配 judge 一起處理）。
