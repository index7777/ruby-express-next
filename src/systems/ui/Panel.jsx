// Panel —— 半透明毛玻璃感的容器面板,對照原始碼兩個實際共用的面板樣式:
// `resultPanel`(結算頁外框)跟 `tiltAskCard`(彈窗卡片),兩者本質是同一種
// 「深色底 + 細描邊 + 陰影/內發光」語言,差別只在要不要收斂成置中卡片
// (`variant="card"` 對照 tiltAskCard 的 26px/22px 內距 + maxWidth 320)還是
// 撐滿容器寬度(`variant="panel"` 對照 resultPanel 的 100% width)。
import { COLORS, RADIUS, SHADOW } from "./tokens.js";

const VARIANTS = {
  // 對照 resultPanel:撐滿寬度,常見於畫面主體區塊(結算頁外框)。
  panel: {
    width: "100%", maxWidth: 320, padding: "16px 14px",
    background: "rgba(13,15,18,0.55)", border: "1px solid rgba(63,224,255,0.22)",
    borderRadius: RADIUS.xl, boxShadow: SHADOW.panel,
  },
  // 對照 tiltAskCard:置中彈窗卡片,底色更實(不透光),常搭配 Dialog 使用。
  card: {
    maxWidth: 320, padding: "26px 22px",
    background: COLORS.bgPanel, border: "1px solid rgba(63,224,255,0.35)",
    borderRadius: RADIUS.xl, boxShadow: SHADOW.dialog,
  },
};

export default function Panel({ variant = "panel", style, children }) {
  const base = VARIANTS[variant] || VARIANTS.panel;
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        boxSizing: "border-box", color: COLORS.textPrimary,
        ...base,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
