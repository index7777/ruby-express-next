// LeaderboardScene —— 對照原始碼 `phase==="leaderboard"`(index.html
// 4336-4355 行)營運看板。
//
// ⚠️ 修正:原本一直只顯示寫死的 `DEFAULT_LEADERBOARD`(demo 假資料),對照
// 原始碼(3567-3568 行)掛載時其實會 `fetch("assets/leaderboard.json")`
// 拿真正的榜單,拿得到就換掉(格式 `[{name,score,line}]` 或
// `{board:[...]}`兩種都接受)——`public/assets/leaderboard.json` 這個
// 檔案本體早就搬進 `web-build-next` 了,只是這個場景從來沒有真的呼叫
// fetch 去讀它。拿不到就維持 `DEFAULT_LEADERBOARD` fallback,不彈錯誤
// (跟原始碼一樣,這仍然只是「示範榜單」,不是真正串接玩家資料的後台,
// 這個 `.json` 檔案本身也還是靜態內容,不是即時排行——這一塊即時排行
// 後台原始碼本來就沒做,不是這次的範圍)。
import { useEffect, useState } from "react";
import { ART } from "../assets/index.js";
import { DEFAULT_LEADERBOARD } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";

export default function LeaderboardScene({ onBack }) {
  const [board, setBoard] = useState(DEFAULT_LEADERBOARD);
  useEffect(() => {
    let cancelled = false;
    fetch("assets/leaderboard.json")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const arr = Array.isArray(d) ? d : d && d.board;
        if (Array.isArray(arr) && arr.length) setBoard(arr);
      })
      .catch(() => { /* 拿不到就維持 DEFAULT_LEADERBOARD,對照原始碼 .catch(()=>{}) */ });
    return () => { cancelled = true; };
  }, []);
  const rows = [...board].sort((a, b) => b.score - a.score).slice(0, 12);
  return (
    <MenuLayout title="營運看板" subtitle="時刻表佈告欄 · 全體排名" bg={ART.lobbyBg} onBack={onBack}>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", padding: "8px 10px", background: "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
          <span style={{ width: 28 }}>#</span><span style={{ flex: 1 }}>旅客</span><span style={{ width: 70 }}>路線</span><span style={{ width: 70, textAlign: "right" }}>分數</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", padding: "8px 10px", fontSize: 12,
            background: i < 3 ? "rgba(255,215,0,0.08)" : "transparent",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ width: 28, fontWeight: 700 }}>{i + 1}</span>
            <span style={{ flex: 1 }}>{r.name}</span>
            <span style={{ width: 70, opacity: 0.7 }}>{r.line || "—"}</span>
            <span style={{ width: 70, textAlign: "right", fontWeight: 700 }}>{r.score}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>※ 目前為示範排名,實際榜單待接後台</div>
    </MenuLayout>
  );
}
