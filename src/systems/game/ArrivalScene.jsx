// ArrivalScene —— 對照原始碼 `phase==="arrival"`(index.html 5407-5552 行)
// 到站畫面:成績摘要(評級/分數/準確率)+ 肉鴿卡三選一 + 重抽(-30 哩程,
// 每次到站限一次)+「我要下車」/「繼續共GO」。
//
// ⚠️ 刻意簡化(規模最大的一個畫面,見 game/README.md 完整說明):
// - 原始碼是可以左右滑動的 carousel(置中放大、側邊縮小),這裡改成
//   直排的可點選卡片清單(重用 `ui/Card.jsx`),點哪張就選哪張,選擇行為
//   完全對照原始碼(選一張才能繼續、可在按下「繼續」前重選),只是互動
//   手勢改成清單點選,不是 scroll-snap 滑動。
// - 卡背翻面動畫(`cardsFlipped`)沒有做,卡片一開始就正面顯示。
// - 「上次保留的進站增益」(`preBoardActive`,離開時把已抽到但沒選的卡
//   暫存,下次進站前先選)這個較冷門的分支沒有實作,離開時未選的卡直接
//   作廢,下次到站會重新抽三張。
import { useState } from "react";
import { Card, Button, ProgressBar } from "../ui/index.js";

const RANK_COLOR = { S: "#FFD43B", A: "#3FE0FF", B: "#7CFFB0", C: "#C0C8D0" };

export default function ArrivalScene({
  stationName, stationLabel, isLast, stats, points = 0,
  cardsOffer, onPickCard, onReroll, canReroll, rerolled,
  onContinue, onLeave,
}) {
  const [pickedId, setPickedId] = useState(null);

  const pick = (card) => {
    setPickedId(card.id);
    onPickCard(card);
  };

  return (
    <div style={{
      position: "relative", minHeight: "100vh", background: "#0B0D10", color: "#EAF2FF",
      fontFamily: "-apple-system, system-ui, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box",
    }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>到站 · 車門開啟</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{stationName}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{stationLabel}</div>

        {stats && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontSize: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: RANK_COLOR[stats.rank] || "#fff" }}>{stats.rank}</span>
            <span>{stats.score} 分</span>
            <span>準確率 {stats.acc.toFixed(0)}%</span>
          </div>
        )}
        {stats && stats.fc && (
          <div style={{ fontSize: 12, fontWeight: 800, color: "#FFD43B" }}>FULL COMBO!</div>
        )}

        <div style={{ width: "100%", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {pickedId ? "✓ 已選擇(按繼續前可改選)" : "三選一 · 通勤增益"}
            </span>
            {!rerolled && points >= 30 && (
              <Button variant="ghost" style={{ fontSize: 11 }} onClick={onReroll}>🔄 重抽(-30 哩程)</Button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(cardsOffer || []).map((c) => (
              <Card key={c.id} active={pickedId === c.id} onClick={() => pick(c)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {c.icon} {c.name}{c.type === "deal" ? " (惡魔交易)" : ""}
                </div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{c.desc}</div>
              </Card>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <Button variant="ghost" style={{ flex: 1 }} onClick={onLeave}>我要下車</Button>
          <Button variant="primary" style={{ flex: 1 }} onClick={onContinue}>
            {isLast ? "前往終點 BOSS →" : "繼續共GO →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
