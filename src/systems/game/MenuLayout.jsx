// MenuLayout —— 選單/流程畫面共用外殼(2026-07-15 選單流程新增)。
//
// 對照原始碼:`web-build/index.html` 裡 hub/lobby/mode/slots/bossselect/
// records/news/leaderboard/vending/settings/calibrate 這些畫面全部共用
// 同一種外觀語言(`className="gg-screen"` + `.lbg` 背景圖 + `.lscrim`
// 深色遮罩 + `.inner` 內容欄 + `<h2>` 標題 + `.backbtn` 返回按鈕),原本
// 靠一份共用 CSS class 做到,這裡沒有搬 CSS,改用一個共用 React 元件把
// 同樣的版面重新表達出來(背景圖/遮罩/標題/返回按鈕都是同一套邏輯),
// 每個畫面只要專心刻自己的內容區塊,不用每個檔案各自重複一份外殼。
//
// ⚠️ 刻意簡化:原始碼的 `.lbg`/`.lscrim` 有額外的 CSS 動畫(進場淡入等),
// 這裡沒有逐一還原每個轉場動畫,純粹是靜態疊層,行為上不影響任何功能。
import { ART } from "../assets/index.js";
import { COLORS } from "../ui/index.js";

export default function MenuLayout({ title, subtitle, bg = ART.lobbyBg, onBack, backLabel = "‹ 返回", children, footer }) {
  return (
    <div style={{
      position: "relative", minHeight: "100vh", overflow: "hidden",
      background: COLORS.bg, color: COLORS.textPrimary,
      fontFamily: "-apple-system, system-ui, sans-serif",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(11,13,16,0.55), rgba(11,13,16,0.86))" }} />
      <div style={{
        position: "relative", maxWidth: 480, margin: "0 auto", minHeight: "100vh",
        padding: "28px 20px 24px", display: "flex", flexDirection: "column", boxSizing: "border-box",
      }}>
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 4px" }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14, color: COLORS.textSecondary }}>{subtitle}</div>}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingBottom: 8 }}>
          {children}
        </div>
        {footer}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              marginTop: 16, alignSelf: "flex-start", background: "none", border: "none",
              color: COLORS.accentSoft, fontSize: 13, cursor: "pointer", padding: "8px 0",
            }}
          >
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
