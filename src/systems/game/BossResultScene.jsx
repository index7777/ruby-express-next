// BossResultScene —— 對照原始碼 `phase==="result"` 且 `cameFromBossRef`
// 為真的分支(index.html 5554-5628 行)BOSS 討伐結算:討伐成功/失敗大標 +
// 評級勳章 + 風味語句 + 判定分佈 + 分數。
//
// ⚠️ 2026-07-16 使用者實測回報接線:「討伐 BOSS 的結算顯示的內容少了得分
// 明細跟分析」——原本這裡刻意跳過的「查看得分明細」展開區塊(準確率/連段/
// 通關時間/平衡對抗/finisher 各自加分,對照原始碼 5589-5614 行),這次
// `BossScene.jsx` 補上了 `bossBonus`/`eventStats` 兩個欄位(見那邊
// `onFinished()` 呼叫處的註解),這裡把展開區塊接上,逐一對照原始碼欄位。
// 分享成績卡(canvas 截圖)仍然沒有做,不在這次回報範圍內。
import { useState } from "react";
import { accRank } from "../judge/index.js";
import ResultBreakdown from "./ResultBreakdown.jsx";
import { Button, Panel } from "../ui/index.js";

const RANK_COLOR = { S: "#FFD43B", A: "#3FE0FF", B: "#7CFFB0", C: "#C0C8D0" };

export default function BossResultScene({ stats, onRetry, onBack }) {
  const [showDetail, setShowDetail] = useState(false);
  const win = stats.outcome === "win";
  const counts = stats.counts || { perfect: 0, great: 0, good: 0, miss: 0 };
  const ar = accRank(counts);
  const flavor = win ? (ar.fc ? "完美討伐" : stats.maxCombo >= 30 ? "英勇討伐" : "驚險討伐") : "再接再厲";
  const rankColor = RANK_COLOR[ar.rank] || "#fff";
  const bonus = stats.bossBonus;
  const eventStats = stats.eventStats || {};

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
        {/* 對照原始碼 5589-5614 行「查看得分明細」:預設收合,只留一顆
            切換鈕,點擊才展開完整明細——只有討伐成功且真的有 `bossBonus`
            資料(舊呼叫端/測試情境沒傳這個欄位)時才顯示這顆按鈕。 */}
        {win && bonus && (
          <>
            <button
              onClick={() => setShowDetail((v) => !v)}
              style={{
                background: "none", border: "none", color: "#8CEEFF", fontSize: 12,
                cursor: "pointer", padding: "4px 0", textDecoration: "underline",
              }}
            >
              {showDetail ? "收起明細 ▴" : "查看得分明細 ▾"}
            </button>
            {showDetail && (
              <div style={{
                width: "100%", display: "flex", flexDirection: "column", gap: 4,
                fontSize: 12, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px",
              }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>結算明細</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>準確率 {bonus.acc}%</span><b style={{ color: "#8CEEFF" }}>+{bonus.accBonus}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>最高連段 ×{stats.maxCombo}</span><b style={{ color: "#8CEEFF" }}>+{bonus.comboBonus}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>通關時間 {bonus.timeSec}s</span><b style={{ color: "#8CEEFF" }}>+{bonus.timeBonus}</b>
                </div>
                {eventStats.g50 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>二階段平衡對抗 · 達成率 {eventStats.g50.pct}%</span>
                    <b style={{ color: eventStats.g50.score > 0 ? "#8CEEFF" : "#FF8A89" }}>
                      {eventStats.g50.score > 0 ? "+" : ""}{eventStats.g50.score}
                    </b>
                  </div>
                )}
                {eventStats.g30 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>三階段平衡對抗 · 達成率 {eventStats.g30.pct}%</span>
                    <b style={{ color: eventStats.g30.score > 0 ? "#8CEEFF" : "#FF8A89" }}>
                      {eventStats.g30.score > 0 ? "+" : ""}{eventStats.g30.score}
                    </b>
                  </div>
                )}
                {eventStats.finisher && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>公事包最後一擊 · {eventStats.finisher.success ? "成功" : "失敗"}</span>
                    <b style={{ color: eventStats.finisher.score > 0 ? "#8CEEFF" : "#FF8A89" }}>
                      {eventStats.finisher.score > 0 ? "+" : ""}{eventStats.finisher.score}
                    </b>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Panel>
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
        <Button variant="primary" style={{ flex: 1 }} onClick={onRetry}>{win ? "再戰一次" : "重新挑戰"}</Button>
        <Button variant="secondary" style={{ flex: 1 }} onClick={onBack}>回月台</Button>
      </div>
    </div>
  );
}
