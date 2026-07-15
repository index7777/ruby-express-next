// NewsScene —— 對照原始碼 `phase==="news"`(index.html 4317-4334 行)
// 旅客資訊公告欄。
//
// ⚠️ 修正:原本一直只顯示寫死的 `DEFAULT_NEWS`,對照原始碼(3565-3566 行)
// 掛載時其實會 `fetch("assets/announcements.json")` 拿真正的公告內容,
// 拿得到就換掉(格式 `[{date,tag,title,body}]` 或 `{news:[...]}`兩種都
// 接受,原始碼本身就有這個容錯)——`public/assets/announcements.json`
// 這個檔案本體早就搬進 `web-build-next` 了(素材搬移那輪一起搬的),只是
// 這個場景從來沒有真的呼叫 fetch 去讀它,一直顯示 fallback 假資料,現在
// 補上。拿不到(離線/檔案不存在)就靜靜維持 `DEFAULT_NEWS`,不彈錯誤。
import { useEffect, useState } from "react";
import { ART } from "../assets/index.js";
import { DEFAULT_NEWS } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";

export default function NewsScene({ onBack }) {
  const [news, setNews] = useState(DEFAULT_NEWS);
  useEffect(() => {
    let cancelled = false;
    fetch("assets/announcements.json")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const arr = Array.isArray(d) ? d : d && d.news;
        if (Array.isArray(arr) && arr.length) setNews(arr);
      })
      .catch(() => { /* 拿不到就維持 DEFAULT_NEWS,對照原始碼 .catch(()=>{}) */ });
    return () => { cancelled = true; };
  }, []);
  return (
    <MenuLayout title="旅客資訊公告欄" bg={ART.lobbyBg} onBack={onBack}>
      {news.map((n, i) => (
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
