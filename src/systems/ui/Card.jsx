// Card —— 可點擊的清單項目卡片,對照原始碼三個外觀幾乎一致的既有樣式:
// `routeCard`(路線選擇)/`songCard`(選曲)/`stationRow`(站點清單)——三者
// 都是「描邊卡片 + 選中態換色」,差別只在 routeCard 用動態 `borderColor`
// (每條路線一個代表色,呼叫端傳 `accentColor`),songCard 用固定
// `songCardActive` 二值切換。這裡合併成一個共用元件,`accentColor` 預設
// 用 tokens 的 accent 青色(對照 songCardActive 固定用 accent 色的行為),
// 呼叫端要 routeCard 那種「每張卡各自一色」就自己傳不同 `accentColor`。
import { COLORS, RADIUS } from "./tokens.js";

export default function Card({ active, accentColor = COLORS.accent, onClick, style, children }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderRadius: RADIUS.md,
        border: `1px solid ${active ? accentColor : "#3A4450"}`,
        background: active ? accentColor : COLORS.bgCard,
        color: active ? COLORS.bgLed : COLORS.textPrimary,
        textAlign: "left", cursor: onClick ? "pointer" : "default",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
