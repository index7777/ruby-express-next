// LobbyScene —— 對照原始碼 `phase==="lobby"`(index.html 4357-4374 行)
// 選擇月台/路線畫面。三條路線(紅寶線開放,藍寶/翡翠線鎖定,待未來擴充),
// 逐字對照 `ROUTES`/`ROUTE_LETTER`。
import { ART } from "../assets/index.js";
import { ROUTES, ROUTE_LETTER } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";
import { Card } from "../ui/index.js";

export default function LobbyScene({ onSelectRoute, onBack }) {
  return (
    <MenuLayout title="選擇月台" subtitle="SELECT PLATFORM" bg={ART.lobbyBg} onBack={onBack}>
      {ROUTES.map((r, i) => (
        <Card
          key={r.id}
          onClick={() => { if (!r.locked) onSelectRoute(i); }}
          style={{ opacity: r.locked ? 0.55 : 1, cursor: r.locked ? "default" : "pointer" }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#fff",
            background: r.locked ? "#9AA4AD" : r.color,
          }}>
            {ROUTE_LETTER[i]}
          </div>
          <div style={{ flex: 1 }}>
            <b style={{ display: "block", fontSize: 15 }}>{r.name}</b>
            <small style={{ opacity: 0.75 }}>{r.en}{r.locked ? " · 尚未開通" : ""}</small>
          </div>
          <span style={{ fontSize: 16 }}>{r.locked ? "🔒" : "▶"}</span>
        </Card>
      ))}
    </MenuLayout>
  );
}
