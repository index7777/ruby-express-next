// Button —— 搬自 `web-build/index.html` 5874 行起真的存在、真的被 7 處
// `<GameButton variant="primary|secondary|ghost">` 呼叫的 `GameButton` 元件
// (不是重寫,邏輯逐字對照:pointerDown/pointerUp/pointerLeave/pointerCancel
// 四個事件都要接,才不會手指滑出按鈕範圍後 pressed 狀態卡住不放開——這是
// 原始碼已經處理過的細節,搬過來時刻意保留,不是這次新加的)。
//
// 三種 variant 逐一對照原始碼的 `resultBtnPrimary`/`resultBtnSecondary`/
// `resultBtnGhost`,數值從 tokens.js 讀,不是重新設計新樣式。
import { useState } from "react";
import { COLORS, RADIUS, SHADOW, TRANSITION, PRESS_SCALE } from "./tokens.js";

const VARIANTS = {
  // 對照 resultBtnPrimary:漸層填色 + 立體投影,是三者中視覺權重最高的,
  // 一個畫面通常只該有一個 primary(比照原始碼結算頁「繼續共GO →」)。
  primary: {
    padding: "13px 18px", fontSize: 15, fontWeight: 900, letterSpacing: 1.5,
    color: COLORS.bgLed,
    background: `linear-gradient(180deg, ${COLORS.accentGradientTop}, ${COLORS.accentGradientBottom})`,
    border: "none", borderRadius: RADIUS.lg, boxShadow: SHADOW.buttonPrimary,
  },
  // 對照 resultBtnSecondary:半透明填色 + 描邊,權重次於 primary(比照
  // 原始碼結算頁「回月台」)。
  secondary: {
    padding: "12px 16px", fontSize: 14, fontWeight: 800, letterSpacing: 1,
    color: COLORS.accentSoft, background: "rgba(63,224,255,0.08)",
    border: `1.5px solid rgba(63,224,255,0.5)`, borderRadius: RADIUS.lg,
  },
  // 對照 resultBtnGhost:幾乎不佔視覺重量,通常是「次要/跳過」選項
  // (比照原始碼「分享成績卡」)。
  ghost: {
    background: "none", border: "1px solid rgba(255,255,255,0.22)",
    color: COLORS.textSecondary, borderRadius: RADIUS.md,
    padding: "8px 18px", fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
  },
};

export default function Button({ variant = "secondary", style, onClick, disabled, children }) {
  const [pressed, setPressed] = useState(false);
  const base = VARIANTS[variant] || VARIANTS.secondary;
  return (
    <button
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        touchAction: "manipulation",
        transition: TRANSITION.press,
        ...base,
        ...(pressed && !disabled ? { transform: `scale(${PRESS_SCALE})` } : null),
        ...(disabled ? { opacity: 0.4 } : null),
        ...style,
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
    >
      {children}
    </button>
  );
}
