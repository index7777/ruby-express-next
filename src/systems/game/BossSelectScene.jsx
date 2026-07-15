// BossSelectScene —— 對照原始碼 `phase==="bossselect"`(index.html
// 4574-4599 行)BOSS 戰測試選王畫面。列出 `BOSSES` 名冊,點一隻直接進
// BossScene。
//
// ⚠️ 刻意簡化:原始碼點選前有 `askTiltThen(...)`(手機陀螺儀權限詢問),
// 這裡略過(理由同 HubScene 練習模式),直接呼叫 `onSelectBoss(b.id)`。
import { ART } from "../assets/index.js";
import { BOSSES } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";

export default function BossSelectScene({ onSelectBoss, onBack }) {
  return (
    <MenuLayout title="選擇 BOSS" subtitle="SELECT BOSS · 測試各王機制" bg={ART.stagemapBg} onBack={onBack}>
      {BOSSES.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelectBoss(b.id)}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 12, border: `1.5px solid ${b.color}`, background: "rgba(20,22,26,0.7)",
            color: "inherit", textAlign: "left", cursor: "pointer",
          }}
        >
          <span style={{
            width: 12, height: 12, borderRadius: "50%", background: b.color, flexShrink: 0,
            boxShadow: `0 0 10px ${b.color}`,
          }} />
          <div style={{ flex: 1 }}>
            <b style={{ display: "block", fontSize: 14 }}>{b.name}</b>
            <small style={{ color: b.color }}>{b.sub}</small>
          </div>
          <span style={{ fontSize: 12, color: b.color }}>挑戰 →</span>
        </button>
      ))}
    </MenuLayout>
  );
}
