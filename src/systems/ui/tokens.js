// tokens —— 統一 UI 設計系統的共用常數(顏色/圓角/陰影/字重/留白/轉場)。
//
// 搬入來源:不是憑空發明,而是從 `web-build/index.html` 6492 行裡那個真的
// 存在、真的被 7 處 `<GameButton variant=.../>` 呼叫的 `styles` 物件(定義於
// 該檔案 5970 行起)裡,把重複出現次數最多、跨越多個畫面共用的顏色/圓角/
// 陰影數值抽出來整理成一份「有名字」的設計語彙,而不是逐一複製貼上每個
// one-off 的 style key(那樣只是把 6492 行的散落 inline style 原封不動搬過
// 來,不是「設計系統」)。
//
// 每個 token 後面的註解都標明抄自原始碼哪個既有 style key,方便之後對照
// 原始畫面調整數值時知道改了會影響哪裡。
export const COLORS = {
  // 背景:App 外層 page(#0B0D10)/卡片面板(#161A20, tiltAskCard)/
  // LED 顯示風格底(#0D0F12, splashLed)。
  bg: "#0B0D10",
  bgPanel: "#161A20",
  bgLed: "#0D0F12",
  bgCard: "rgba(32,36,42,0.85)", // routeCard/songCard/stationRow 共用底色

  // 青色系:整個原始碼裡出現次數最多的強調色家族,判定線/HUD 光暈/
  // GameButton primary 都用這個色系(#3FE0FF 為基準色,resultBtnPrimary
  // 用漸層 #5CEBFF→#17C4E8 做「立體按鈕」的高光/陰影對比)。
  accent: "#3FE0FF",
  accentSoft: "#8FE0FF",
  accentGradientTop: "#5CEBFF", // resultBtnPrimary 漸層起點
  accentGradientBottom: "#17C4E8", // resultBtnPrimary 漸層終點
  accentShadow: "#0A7FA0", // resultBtnPrimary 立體投影色

  // 金色系:combo/評級/星等相關的「重要數值」共用色(comboText/
  // hubPoints/imbalanceCount 都是這個色系)。
  gold: "#FFD700",
  goldAlt: "#FFD43B", // hubPoints/imbalanceCount 用的是這個色號,兩個金色
                       // 数值在原始碼裡並存(不同時期加的畫面各自沿用),
                       // 這裡兩個都留著給呼叫端依情境選,不勉強合併成一個。

  // 橘色系:次要強調(bossPhaseAlertP2 暖色警示、道具/vend 相關)。
  ember: "#FF9F45",

  // 危險色系:miss/嚴重失衡/BOSS 警示共用(dangerVignette、
  // imbalanceTitle、laneLockRing)。
  danger: "#FF3C3C",
  dangerSoft: "#FF6A6A",

  // 成功/穩定色系(great 判定、穩定度條「安全」區間)。
  success: "#59E38C",

  // 文字:主文字白、次要文字灰藍(#C0C8D0 是原始碼裡除了純白外出現次數
  // 最多的文字色,helpText/routeEn/imbalanceSub 等大量沿用)。
  textPrimary: "#FFFFFF",
  textSecondary: "#C0C8D0",
  textMuted: "#8A939E",
};

export const RADIUS = {
  sm: 8,   // toggleBtn/backBtn 這類小按鈕
  md: 12,  // 原始碼裡出現次數最多的圓角(primaryBtn/topBar/vendCard...)
  lg: 14,  // resultBtnPrimary/resultBtnSecondary/tiltAskBtn
  xl: 16,  // resultPanel/tiltAskCard(卡片/面板級別的圓角)
  pill: 999, // trackChip 這類藥丸形狀
  circle: "50%",
};

export const SHADOW = {
  // resultBtnPrimary 的「立體按下感」雙層陰影:實體投影 + 發光暈。
  buttonPrimary: `0 4px 0 ${COLORS.accentShadow}, 0 6px 16px rgba(63,224,255,0.35)`,
  // tiltAskCard/resultPanel 共用的「面板飄浮感」陰影。
  panel: "0 8px 28px rgba(0,0,0,0.35), inset 0 0 30px rgba(63,224,255,0.05)",
  dialog: "0 10px 40px rgba(0,0,0,0.5)",
  glow: (color) => `0 0 10px ${color}`,
};

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24,
};

export const FONT = {
  // 原始碼全域唯一一處明確設定的字體(#boot 載入畫面 + styles.page),
  // 其餘畫面沒設 font-family、吃瀏覽器預設——這裡定為整個設計系統的
  // 統一字體,之後 Phase 8 之後接進真正畫面時,理論上應該讓所有畫面
  // 都套用這個而不是各自留白(這是這次刻意做的「統一」,不是照抄)。
  family: "'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'Courier New', monospace", // splashLed / LED 風格顯示沿用
};

export const TRANSITION = {
  press: "transform 0.08s, box-shadow 0.08s", // resultBtnPrimary 按下回饋
  fill: "width 0.2s, background 0.3s", // stabilityFill 進度條變化
};

// 按下態統一位移量(resultBtnPressed:{ transform: "scale(0.95)" }),
// GameButton 的 pointerDown/pointerUp 都共用這個常數。
export const PRESS_SCALE = 0.95;
