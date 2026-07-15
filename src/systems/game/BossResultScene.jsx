// BossResultScene —— 對照原始碼 `phase==="result"` 且 `cameFromBossRef`
// 為真的分支(index.html 5554-5628 行)BOSS 討伐結算:討伐成功/失敗大標 +
// 評級勳章 + 風味語句 + 判定分佈 + 分數。
//
// ⚠️ 刻意簡化:原始碼「查看得分明細」的展開式分項(準確率/連段/通關時間/
// 平衡對抗/finisher 各自加分)需要 BossScene 額外收集通關時間跟事件分項
// 統計,這個場景目前只吃 `engine.getState()` 現有的 counts/maxCombo/
// score/stability,沒有這些額外分項數據,先不做「查看得分明細」這個展開
// 區塊,詳見 `game/README.md`。分享成績卡(canvas 截圖)也沒有做。
import { accRank } from "../judge/index.js";
import ResultBreakdown from "./ResultBreakdown.jsx";
import { Button, Panel } from "../ui/index.js";

const RANK_COLOR = { S: "#FFD43B", A: "#3FE0FF", B: "#7CFFB0", C: "#C0C8D0" };

export default function BossResultScene({ stats, onRetry, onBack }) {
  const win = stats.outcome === "win";
  const counts = stats.counts || { perfect: 0, great: 0, good: 0, miss: 0 };
  const ar = accRank(counts);
  const flavor = win ? (ar.fc ? "完美討伐" : stats.maxCombo >= 30 ? "英勇討伐" : "驚險討伐") : "再接再厲";
  const rankColor = RANK_COLOR[ar.rank] || "#fff";

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0D10", color: "#EAF2FF",
      fontFamily: "-apple-system, system-ui, sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 20, gap: 16, boxSizing: "border-box",
    }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: win ? "#FFD43B" : "#FF6A6A" }}>
        {win ? "討伐成功!" : "討伐失敗"}
      </div>
      <Panel variant="panel">
        <div style={{
          width: 90, height: 90, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          border: `4px solid ${rankColor}`, fontSize: 40, fontWeight: 900, color: rankColor,
          boxShadow: `0 0 20px ${rankColor}55`,
        }}>
          {ar.rank}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: win ? "#FFD43B" : "#C0C8D0" }}>
          {flavor}{ar.fc ? " · FULL COMBO" : ""}
        </div>
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.12)", margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 12 }}>
          <span>你的剩餘體力</span>
          <b style={{ color: (stats.playerHp ?? 100) <= 0 ? "#FF6A6A" : "#7CFFB0" }}>{Math.round(stats.playerHp ?? 100)}%</b>
        </div>
        <ResultBreakdown counts={counts} />
        <div style={{ fontSize: 30, fontWeight: 900 }}>{stats.score}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>分數 · 最高 COMBO ×{stats.maxCombo}</div>
      </Panel>
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
        <Button variant="primary" style={{ flex: 1 }} onClick={onRetry}>{win ? "再戰一次" : "重新挑戰"}</Button>
        <Button variant="secondary" style={{ flex: 1 }} onClick={onBack}>回月台</Button>
      </div>
    </div>
  );
}
