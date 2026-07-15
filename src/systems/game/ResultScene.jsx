// ResultScene —— 對照原始碼 `phase==="result"` 一般關卡分支(index.html
// 5629-5664 行)行程結算:星等評語 + 判定分佈 + 分數 + 事件加分(驅散
// 背包客/清除雜訊)。
//
// ⚠️ 刻意簡化:分享成績卡(canvas 截圖)沒有做,`eventStats`(背包客/雜訊
// 加分明細)這個場景沒有從 PlayScene 收集對應數字,先不顯示這塊(對照
// 原始碼是額外的、不影響核心結算資訊的加分明細)。
import { starRating } from "../judge/index.js";
import ResultBreakdown from "./ResultBreakdown.jsx";
import { Button, Panel } from "../ui/index.js";

export default function ResultScene({ stats, gameMode, onRetry, onBack, backLabel }) {
  const counts = stats.counts || { perfect: 0, great: 0, good: 0, miss: 0 };
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  const fc = counts.miss === 0 && total > 0;
  const r = starRating(stats.stability ?? 100);

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0D10", color: "#EAF2FF",
      fontFamily: "-apple-system, system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 20, gap: 16, boxSizing: "border-box",
    }}>
      <div style={{ fontSize: 22, fontWeight: 900 }}>行程結算</div>
      <Panel variant="panel">
        <div style={{ fontSize: 22 }}>{"🚆".repeat(r.star)}</div>
        <div style={{ color: "#FFD700", fontSize: 16, fontWeight: 800 }}>{r.label}</div>
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.12)", margin: "4px 0" }} />
        <ResultBreakdown counts={counts} />
        {fc && <div style={{ fontSize: 12, fontWeight: 800, color: "#FFD43B" }}>FULL COMBO!</div>}
        <div style={{ fontSize: 30, fontWeight: 900 }}>{stats.score}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>分數 · 最高 COMBO ×{stats.maxCombo}</div>
      </Panel>
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
        <Button variant="primary" style={{ flex: 1 }} onClick={onRetry}>重新挑戰</Button>
        <Button variant="secondary" style={{ flex: 1 }} onClick={onBack}>{backLabel || (gameMode === "commute" ? "回選站" : "回月台")}</Button>
      </div>
    </div>
  );
}
