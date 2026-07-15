// ModeScene —— 對照原始碼 `phase==="mode"`(index.html 4501-4525 行)
// 選擇模式畫面:通勤模式(→ slots)/自由模式(→ songselect)/BOSS 戰測試
// (→ bossselect)。
import { ART } from "../assets/index.js";
import { ROUTES } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";
import { Card } from "../ui/index.js";

const MODES = [
  { key: "commute", icon: "🚈", label: "通勤模式", desc: "5 站逐站挑戰 · 全通後打王" },
  { key: "free", icon: "🎵", label: "自由模式", desc: "自由選單曲 · 記錄成績" },
  { key: "bossTest", icon: "👹", label: "BOSS 戰測試", desc: "選擇想挑戰的 BOSS · 測試機制" },
];

export default function ModeScene({ routeIdx = 0, onCommute, onFree, onBossTest, onBack }) {
  const HANDLERS = { commute: onCommute, free: onFree, bossTest: onBossTest };
  return (
    <MenuLayout title="選擇模式" subtitle={ROUTES[routeIdx].name} bg={ART.lobbyBg} onBack={onBack}>
      {MODES.map((m) => (
        <Card key={m.key} onClick={HANDLERS[m.key]}>
          <span style={{ fontSize: 24 }}>{m.icon}</span>
          <div style={{ flex: 1 }}>
            <b style={{ display: "block", fontSize: 14 }}>{m.label}</b>
            <small style={{ opacity: 0.75 }}>{m.desc}</small>
          </div>
        </Card>
      ))}
    </MenuLayout>
  );
}
