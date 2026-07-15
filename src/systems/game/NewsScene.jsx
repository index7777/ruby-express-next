// NewsScene —— 對照原始碼 `phase==="news"`(index.html 4317-4334 行)
// 旅客資訊公告欄,靜態清單,目前用 `DEFAULT_NEWS` fallback(對照原始碼
// 執行期還會 fetch `assets/announcements.json`,這裡沒有接動態載入,
// 詳見 `game/README.md`)。
import { ART } from "../assets/index.js";
import { DEFAULT_NEWS } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";

export default function NewsScene({ onBack }) {
  return (
    <MenuLayout title="旅客資訊公告欄" bg={ART.lobbyBg} onBack={onBack}>
      {DEFAULT_NEWS.map((n, i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "rgba(63,224,255,0.2)", color: "#3FE0FF" }}>{n.tag || "公告"}</span>
            <b style={{ fontSize: 13 }}>{n.title}</b>
            <span style={{ fontSize: 10, opacity: 0.6, marginLeft: "auto" }}>{n.date}</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.6 }}>{n.body}</div>
        </div>
      ))}
    </MenuLayout>
  );
}
