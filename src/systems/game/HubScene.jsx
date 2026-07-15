// HubScene —— 對照原始碼 `phase==="hub"`(index.html 4184-4224 行)月台
// 大廳。頂部哩程 + 每日任務跑馬燈,底下 7 個設施卡片(開始通勤/乘車紀錄/
// 旅客資訊/營運看板/行控中心/自動販賣機/練習模式)。
//
// ⚠️ 刻意簡化:原始碼「練習模式」點下去前有 `askTiltThen(...)`(手機陀螺儀
// 權限詢問彈窗),這裡沒有做陀螺儀權限流程(那是 IS_TOUCH 手機板才會走到
// 的分支,桌機測試不會觸發),直接呼叫 `onPractice`,詳見 README。
import { useMemo } from "react";
import { ART } from "../assets/index.js";
import { loadSave } from "../save/index.js";
import { DAILY_POOL, rollDaily } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";
import { Card } from "../ui/index.js";

const FACILITIES = [
  { key: "commute", icon: "🚈", label: "開始通勤", primary: true },
  { key: "records", icon: "📖", label: "乘車紀錄" },
  { key: "news", icon: "📢", label: "旅客資訊" },
  { key: "leaderboard", icon: "🏆", label: "營運看板" },
  { key: "settings", icon: "🎛", label: "行控中心" },
  { key: "vending", icon: "🎫", label: "自動販賣機" },
  { key: "practice", icon: "🥁", label: "練習模式" },
];

export default function HubScene({ onGoCommute, onGoRecords, onGoNews, onGoLeaderboard, onGoSettings, onGoVending, onPractice, onLeave }) {
  const save = useMemo(() => loadSave(), []);
  const daily = useMemo(() => rollDaily(save), [save]);

  const HANDLERS = {
    commute: onGoCommute, records: onGoRecords, news: onGoNews,
    leaderboard: onGoLeaderboard, settings: onGoSettings, vending: onGoVending, practice: onPractice,
  };

  return (
    <MenuLayout title="月台大廳" bg={ART.lobbyBg} onBack={onLeave} backLabel="‹ 離站">
      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFD43B", marginBottom: 4 }}>
        🪙 哩程:{(save.points || 0).toLocaleString()} 點
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10,
        background: "rgba(13,15,18,0.6)", border: "1px solid rgba(63,224,255,0.25)", marginBottom: 6,
        overflow: "hidden",
      }}>
        <span style={{ fontSize: 11, color: "#8FE0FF", flexShrink: 0 }}>今日任務</span>
        <div style={{ display: "flex", gap: 20, overflow: "hidden", fontSize: 11, whiteSpace: "nowrap" }}>
          {(daily.taskIds || []).map((id) => {
            const def = DAILY_POOL.find((x) => x.id === id);
            if (!def) return null;
            const done = daily.doneIds.includes(id);
            const prog = Math.min(def.target, (daily.progress && daily.progress[id]) || 0);
            return (
              <span key={id} style={{ color: done ? "#7CFFB0" : "#FFD43B" }}>
                {done ? "✅" : "▸"} {def.label}({prog}/{def.target})
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
        {FACILITIES.map((f) => (
          <Card
            key={f.key}
            onClick={HANDLERS[f.key]}
            style={{
              flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
              gridColumn: f.primary ? "1 / span 2" : undefined,
              padding: "16px 10px", minHeight: 74,
              ...(f.primary ? { background: "rgba(63,224,255,0.16)", borderColor: "#3FE0FF" } : {}),
            }}
          >
            <span style={{ fontSize: 26 }}>{f.icon}</span>
            <b style={{ fontSize: 13 }}>{f.label}</b>
          </Card>
        ))}
      </div>
    </MenuLayout>
  );
}
