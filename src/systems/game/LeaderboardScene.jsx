// LeaderboardScene —— 對照原始碼 `phase==="leaderboard"`(index.html
// 4336-4355 行)營運看板,目前是示範假資料(`DEFAULT_LEADERBOARD`),
// 待接後台,對照原始碼註記原封不動保留。
import { ART } from "../assets/index.js";
import { DEFAULT_LEADERBOARD } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";

export default function LeaderboardScene({ onBack }) {
  const rows = [...DEFAULT_LEADERBOARD].sort((a, b) => b.score - a.score).slice(0, 12);
  return (
    <MenuLayout title="營運看板" subtitle="時刻表佈告欄 · 全體排名" bg={ART.lobbyBg} onBack={onBack}>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", padding: "8px 10px", background: "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
          <span style={{ width: 28 }}>#</span><span style={{ flex: 1 }}>旅客</span><span style={{ width: 70 }}>路線</span><span style={{ width: 70, textAlign: "right" }}>分數</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", padding: "8px 10px", fontSize: 12,
            background: i < 3 ? "rgba(255,215,0,0.08)" : "transparent",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ width: 28, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ flex: 1 }}>{r.name}</span>
            <span style={{ width: 70, opacity: 0.7 }}>{r.line || "—"}</span>
            <span style={{ width: 70, textAlign: "right", fontWeight: 700 }}>{r.score}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>※ 目前為示範排名,實際榜單待接後台</div>
    </MenuLayout>
  );
}
