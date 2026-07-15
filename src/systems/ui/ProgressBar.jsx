// ProgressBar —— 對照原始碼 `stabilityTrack`/`stabilityFill`(嚴重失衡穩定度
// 條)跟 `balanceBar`(平衡對抗量表)這兩個外觀相同的「軌道 + 填充條」樣式
// 合併成一個共用元件。填充色預設用 `utils.js` 的 `progressColor()`(數值
// 越低越危險的三段式配色),呼叫端也可以直接傳 `color` 覆蓋(例如原始碼
// `stabilityColor()` 那種 0~100 刻度、或固定單一顏色的情境)。
import { clamp01, progressColor } from "./utils.js";

export default function ProgressBar({ value, color, height = 10, style, fillStyle }) {
  const ratio = clamp01(value);
  const fillColor = color || progressColor(ratio);
  return (
    <div
      style={{
        width: "100%", height, borderRadius: height / 2, overflow: "hidden",
        background: "rgba(13,15,18,0.6)", position: "relative",
        boxShadow: "inset 0 0 8px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div
        style={{
          height: "100%", width: `${ratio * 100}%`,
          background: fillColor, color: fillColor,
          transition: "width 0.2s, background 0.3s",
          boxShadow: "0 0 6px currentColor",
          ...fillStyle,
        }}
      />
    </div>
  );
}
