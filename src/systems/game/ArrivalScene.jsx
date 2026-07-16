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
import { cardArt } from "../assets/index.js";

const REROLL_COST = 30; // 對照原始碼「重抽」扣點,跟下面 onReroll 呼叫端共用同一個數字
const REVIVE_COST_HINT = 80; // 只是給玩家先看到的參考數字(對照 BossScene.jsx 的 REVIVE_COST),這個畫面本身不會扣復活的點

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
            {/* 2026-07-16 使用者實測回報接線:重抽按鈕過去只判斷「夠不夠扣」,
                完全沒有顯示玩家目前的哩程點數本身,玩家不知道自己還剩多少、
                重抽/等下復活夠不夠用。這裡把目前點數 + 這次重抽要扣的點數
                都顯示出來(見下面 `pointsRow`),不是只留一個按鈕自己猜。 */}
            {!rerolled && (
              <Button
                variant="ghost" style={{ fontSize: 11 }} onClick={onReroll}
                disabled={points < REROLL_COST}
              >
                🔄 重抽(-{REROLL_COST} 哩程)
              </Button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(cardsOffer || []).map((c) => (
              <Card key={c.id} active={pickedId === c.id} onClick={() => pick(c)} style={{ gap: 8 }}>
                {/* 2026-07-16 使用者實測回報接線:`ArrivalScene`(真正的到站
                    結算/三選一流程,通勤模式每站都會走這個畫面)過去只顯示
                    `c.icon` emoji,完全沒有用到 `assets/art.js` 的
                    `cardArt(id)`(19 張 `card-*.png` 插圖,`PlayScene.jsx`/
                    `BossScene.jsx` 裡的「demo 版」抽卡 Dialog 已經接過,但
                    這個才是玩家實測會真的走到的畫面,之前漏接)。 */}
                <img src={cardArt(c.id)} alt={c.name} style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {c.icon} {c.name}{c.type === "deal" ? " (惡魔交易)" : ""}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>{c.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 2026-07-16 使用者實測回報接線:目前累積哩程點數顯示——過去這個
            畫面雖然收了 `points` prop(給上面重抽按鈕的門檻判斷用),卻完全
            沒有顯示出來過,玩家看不到自己有多少點,不知道重抽/等下 BOSS
            戰復活(`BossScene.jsx` REVIVE_COST=80)夠不夠扣。這裡加一行
            清楚的點數列,重抽扣點後 `points` prop 會由上層(App.jsx)重新
            算好傳進來,這裡不用自己算剩餘值。 */}
        <div style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 12, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)",
        }}>
          <span style={{ opacity: 0.75 }}>目前哩程點數</span>
          <b style={{ color: points >= REROLL_COST ? "#FFD43B" : "#FF8A89" }}>{points}</b>
        </div>
        {points < REVIVE_COST_HINT && (
          <div style={{ fontSize: 11, color: "#FF8A89", opacity: 0.85, textAlign: "center" }}>
            ⚠ 哩程不足 {REVIVE_COST_HINT}(BOSS 戰復活所需),還差 {REVIVE_COST_HINT - points} 點
          </div>
        )}

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
