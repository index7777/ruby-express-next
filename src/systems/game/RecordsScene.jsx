// RecordsScene —— 對照原始碼 `phase==="records"`(index.html 4226-4273 行)
// 乘車紀錄:三分頁(乘車軌跡=成就 / 車站收藏 / 累積里程=統計數字)。
import { useMemo, useState } from "react";
import { ART } from "../assets/index.js";
import { loadSave } from "../save/index.js";
import { ACHIEVEMENTS, STATION_NAMES, STATION_EN, BOSS_NAME, BOSS_SUB } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";

const TABS = ["乘車軌跡", "車站收藏", "累積里程"];

export default function RecordsScene({ onBack }) {
  const [tab, setTab] = useState(0);
  const save = useMemo(() => loadSave(), []);
  const cleared = (save.routes && save.routes.ruby && save.routes.ruby.stationCleared) || [];
  const achDone = ACHIEVEMENTS.filter((a) => save.achievements && save.achievements[a.id]).length;

  return (
    <MenuLayout title="乘車紀錄" bg={ART.lobbyBg} onBack={onBack}>
      <div style={{ display: "flex", gap: 6 }}>
        {TABS.map((nm, i) => (
          <button
            key={nm}
            onClick={() => setTab(i)}
            style={{
              flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              border: `1px solid ${tab === i ? "#3FE0FF" : "#3A4450"}`,
              background: tab === i ? "rgba(63,224,255,0.15)" : "transparent",
              color: tab === i ? "#3FE0FF" : "#C0C8D0",
            }}
          >
            {nm}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>成就 {achDone} / {ACHIEVEMENTS.length}</div>
          {ACHIEVEMENTS.map((a) => {
            const on = save.achievements && save.achievements[a.id];
            return (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", opacity: on ? 1 : 0.5 }}>
                <span style={{ fontWeight: 700, color: on ? "#FFD43B" : "#C0C8D0", fontSize: 12 }}>{on ? "🏅" : "🔒"} {a.name}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{a.desc}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>紅寶線 車站圖鑑</div>
          {STATION_NAMES.map((nm, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", opacity: cleared[i] ? 1 : 0.5 }}>
              <span style={{ fontWeight: 700, color: cleared[i] ? "#7CFFB0" : "#C0C8D0", fontSize: 12 }}>{cleared[i] ? "✅" : "🔒"} 第 {i + 1} 站 {nm}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{STATION_EN[i]}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", opacity: save.routes?.ruby?.bossDefeated ? 1 : 0.5 }}>
            <span style={{ fontWeight: 700, color: save.routes?.ruby?.bossDefeated ? "#FF8A89" : "#C0C8D0", fontSize: 12 }}>
              {save.routes?.ruby?.bossDefeated ? "👑" : "🔒"} 終點 BOSS {save.routes?.ruby?.bossDefeated ? BOSS_NAME : "？？？"}
            </span>
            <span style={{ fontSize: 11, opacity: 0.8 }}>{save.routes?.ruby?.bossDefeated ? BOSS_SUB : "討伐後解鎖"}</span>
          </div>
        </div>
      )}

      {tab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["總遊玩場數", `${(save.stats && save.stats.plays) || 0} 場`, "#3FE0FF"],
            ["累積里程(估)", `${(((save.stats && save.stats.plays) || 0) * 1.6).toFixed(1)} km`, "#3FE0FF"],
            ["最高分", `${(save.best && save.best.score) || 0}`, "#FFD43B"],
            ["最高 COMBO", `×${(save.best && save.best.maxCombo) || 0}`, "#FFD43B"],
            ["BOSS 討伐次數", `${(save.stats && save.stats.bossKills) || 0}`, "#FF8A89"],
            ["成就進度", `${achDone} / ${ACHIEVEMENTS.length}`, "#7CFFB0"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", fontSize: 13 }}>
              <span>{label}</span><b style={{ color }}>{val}</b>
            </div>
          ))}
        </div>
      )}
    </MenuLayout>
  );
}
