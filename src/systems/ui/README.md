# ui

搬入範圍：統一 UI 設計系統——Button / Panel / Popup / Dialog / Card / HUD /
Progress Bar，全部共用同一套圓角、陰影、發光、動畫、字體、留白規範。

## 狀態：Phase 8 完成 + 2026-07-15j 已接線

- ⚠️ **接線更新**:`Button`/`ProgressBar`/`Dialog` 已經接進
  `game/PlayScene.jsx`(離開按鈕、穩定度條)跟新增的 `game/BossScene.jsx`
  (離開/命中回饋按鈕、BOSS·玩家 HP 條、finisher QTE/平衡對抗閘門讀出、
  復活詢問/勝利畫面的 Dialog),不再只是 `App.jsx` 展示區塊裡的示範,
  詳見 `game/README.md`。

- **重要發現**：原本以為 `GameButton`/`styles` 是原始碼裡的孤兒引用(只有
  呼叫端、沒有定義),追查後發現其實兩者都**真的存在**——`web-build/
  index.html` 6492 行裡,`GameButton` 定義在 5874 行、`styles` 物件定義在
  5970 行,共 7 處 `<GameButton variant="primary|secondary|ghost">` 呼叫。
  (排查過程中曾被沙箱掛載快取問題誤導,見下方「刻意沒做的部分」)。這次
  Phase 8 因此不是「憑空發明一套新設計系統」,而是把這個真的存在、真的
  被多處共用的既有語言**逐一對照搬過來**,再整理成有名字的 tokens。
- `tokens.js`：`COLORS`/`RADIUS`/`SHADOW`/`SPACING`/`FONT`/`TRANSITION`/
  `PRESS_SCALE`——從 `styles` 物件裡出現次數最多、跨畫面共用的數值抽出來
  整理,每個常數都在註解標明抄自哪個既有 style key。
- `utils.js`：純邏輯 helper(跟 `.jsx` 元件拆開,因為沙箱 node 測試腳本沒
  有 JSX 轉譯器)——`clamp01()`、`stabilityColor()`(逐字對照原始碼 3764
  行「穩定度數值→顏色」三段閾值)、`progressColor()`(給沒有特定語意的
  ProgressBar 用的通用版本)。
- `Button.jsx`：搬自 5874 行真的存在的 `GameButton`,pointerDown/Up/Leave/
  Cancel 四個事件都保留(原始碼已經處理過「手指滑出按鈕範圍 pressed 狀態
  卡住」的細節,不是這次新加的),三種 variant 逐一對照
  `resultBtnPrimary`/`resultBtnSecondary`/`resultBtnGhost`。
- `Panel.jsx`：`variant="panel"` 對照 `resultPanel`(撐滿寬度的結算頁外框)
  / `variant="card"` 對照 `tiltAskCard`(置中彈窗卡片)。
- `Card.jsx`：合併 `routeCard`/`songCard`/`stationRow` 三個外觀幾乎一致的
  清單項目樣式,`accentColor` prop 對應 routeCard 那種「每張卡各自一色」
  的用法。
- `ProgressBar.jsx`：合併 `stabilityTrack`/`stabilityFill`(嚴重失衡穩定度
  條)跟 `balanceBar`(平衡對抗量表),`value` 是 0~1 比例,`color` 不傳的話
  用 `progressColor()` 算三段式配色。
- `Dialog.jsx`：對照 `tiltAskOverlay`+`tiltAskCard`(陀螺儀權限詢問/玩家
  取名兩處共用同一組樣式),全螢幕背蓋 + 置中卡片,`title`/`children`/
  `actions` 都是 slot,不綁定特定文案(原始碼兩處使用場景文字完全不同,
  表示這本來就該是殼元件)。
- 沙箱驗證：`npm run build` + node 測試腳本 `test-ui.mjs`(tokens 結構/
  `clamp01`/`stabilityColor`/`progressColor` 斷言)全過,既有測試回歸也
  全過。`App.jsx` 新增一個展示所有元件(Button 三種 variant、Panel 兩種
  variant、Card 選中態、ProgressBar 配色、Dialog 開關)的區塊。

## 跟原始碼的差異(刻意設計，不是照抄)

- `FONT.family` 是**新增的統一決定**:原始碼裡只有 `#boot` 載入畫面跟
  `styles.page` 明確設定過字體,其餘畫面完全沒設 `font-family`、吃瀏覽器
  預設。這裡把 `styles.page` 那組字體訂為整個設計系統的統一字體,之後
  真的接進畫面時理論上所有畫面都該套用,不是像原始碼那樣各自留白——但
  這是「建議」,`Phase 8 完成`只代表系統本身建好,沒有強制套用到任何
  地方。
- `Card` 合併三個原本各自獨立、欄位略有差異的樣式(`routeCard` 有
  `border: "2px solid"` 固定寬度,`songCard`/`stationRow` 是 `1px`),這裡
  統一成 `1px`,如果之後接線發現某個既有畫面在意這個粗細差異,再回來
  依 `style` prop 覆蓋。
- `progressColor()`/`stabilityColor()` 刻意分開兩個函式而不是合併成一個
  「智慧判斷 0~1 還是 0~100」的版本——原始碼的 `stabilityColor` 是 0~100
  刻度的既有邏輯,直接複製數字比猜測轉換規則安全,`ProgressBar` 元件本身
  一律吃 0~1,呼叫端要接 `stabilityColor` 的話自己把 0~100 值除以 100
  再傳,或者不傳 `color`、讓 `progressColor()` 接手。

## 這次刻意沒做的部分

- **實際接線**:沒有把任何既有畫面(`App.jsx` 目前的展示區塊、或之後的
  真正遊戲畫面)換成這裡的元件,現有展示區塊的按鈕/面板維持原樣(各自
  硬寫 inline style),這次只新增一個獨立的 UI 設計系統展示區塊,不動
  已經驗證過的舊畫面,降低回歸風險。
- **HUD 元件**(README 搬入範圍寫的一項)沒有獨立做——`topBar` 這類 HUD
  容器目前判斷用 `Panel` 加一點 `style` 覆蓋就能表達,沒有另外抽一個
  `HUD.jsx`,如果之後接線發現 HUD 有夠多獨特邏輯(例如穩定度/combo/分數
  的排版規則),再回來擴充。
- **沙箱掛載快取問題排查記錄**:這輪一開始誤判 `GameButton`/`styles` 是
  孤兒引用,原因是沙箱 bash 讀 `web-build/index.html` 時一度讀到只有
  5711 行的舊快取版本(實際檔案有 6492 行),用「`mv` 成別名再 `mv` 回
  原名」的技巧刷新後才讀到正確內容。這是 HANDOFF.md 2026-07-15f/g 已經
  記錄過的同一個已知問題,這裡再次確認會影響**讀取既有檔案**、不只是
  「編輯後沒同步」的情境,新機器之後排查資料落差時要把這個情況也考慮
  進去。
