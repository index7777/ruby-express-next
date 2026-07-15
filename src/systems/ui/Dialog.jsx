// Dialog —— 對照原始碼 `tiltAskOverlay` + `tiltAskCard`(陀螺儀權限詢問/
// 玩家取名兩處共用同一組樣式,逐字比對過欄位完全相同)整理成的彈窗元件:
// 全螢幕半透明背蓋(擋掉背景互動,原始碼靠 `zIndex: 40` 蓋過其他畫面元素)
// + 置中卡片(`Panel variant="card"`)。`title`/`children`(內文/表單/自訂
// 內容)/`actions`(按鈕列,呼叫端自己放 `<Button>`)都是 slot,不是這裡
// 寫死文字——原始碼兩處使用場景文字完全不同(權限說明 vs 取名輸入框),
// 表示這本來就該是「殼」而不是綁定特定文案的元件。
import { COLORS } from "./tokens.js";
import Panel from "./Panel.jsx";

export default function Dialog({ open, title, children, actions, onDismiss, style }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "absolute", inset: 0, borderRadius: 20,
        background: "rgba(8,10,13,0.82)", zIndex: 40,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, boxSizing: "border-box",
        ...style,
      }}
      onClick={onDismiss}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Panel variant="card">
          {title && (
            <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.accent, letterSpacing: 2 }}>
              {title}
            </div>
          )}
          {children}
          {actions && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 6 }}>
              {actions}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
