// SplashScene —— 對照原始碼 `phase==="splash"`(index.html 4162-4175 行)
// 開場刷票口畫面。原始碼是純展示(LED 跑馬燈文字輪播 + 漂浮符號 + 刷卡
// 感應圈 + 點卡片進站),沒有複雜 state,這裡逐字對照行為。
//
// ⚠️ 刻意簡化:原始碼的 `splashEntering`/`splashFlash` 是進場/點擊時的
// CSS transition 效果(`entering` class 淡入、點擊時螢幕閃一下),這裡只
// 保留「LED 文字輪播」這個有實際資訊內容的部分,純視覺閃光/淡入效果沒有
// 逐一還原,不影響「點了進大廳」這個核心行為。
import { useEffect, useState } from "react";
import { SPLASH_LED } from "../config/index.js";
import { ART } from "../assets/index.js";
import { COLORS } from "../ui/index.js";

export default function SplashScene({ onEnter }) {
  const [ledIdx, setLedIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLedIdx((i) => (i + 1) % SPLASH_LED.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      onClick={onEnter}
      style={{
        position: "relative", minHeight: "100vh", overflow: "hidden", cursor: "pointer",
        background: COLORS.bg, color: COLORS.textPrimary,
        fontFamily: "-apple-system, system-ui, sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${ART.splashBg})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(11,13,16,0.35), rgba(11,13,16,0.75))" }} />

      <div style={{ position: "relative", textAlign: "center" }}>
        <img src="assets/logo.png" alt="捷運共GO" style={{ maxWidth: 240, marginBottom: 26 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />

        <div style={{
          position: "relative", width: 150, height: 150, margin: "0 auto 26px", borderRadius: "50%",
          border: `2px solid ${COLORS.accent}`, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 26px ${COLORS.accent}55`,
        }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>嗶卡感應</span>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px",
          borderRadius: 999, background: "rgba(13,15,18,0.7)", border: "1px solid rgba(63,224,255,0.3)",
          fontFamily: "'Courier New', monospace", fontSize: 12, color: COLORS.accentSoft, marginBottom: 22,
        }}>
          <img src={ART.ledPanelTex} alt="" style={{ height: 14 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <span>{SPLASH_LED[ledIdx]}</span>
        </div>

        <div
          className="pressable"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px",
            borderRadius: 14, background: `linear-gradient(180deg, ${COLORS.accentGradientTop}, ${COLORS.accentGradientBottom})`,
            color: COLORS.bgLed, fontWeight: 900, fontSize: 15, boxShadow: "0 6px 20px rgba(63,224,255,0.35)",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.bgLed }} />
          開始通勤
        </div>

        <div style={{ marginTop: 30, fontSize: 11, opacity: 0.55, maxWidth: 280, lineHeight: 1.6 }}>
          本遊戲內登場之內容純屬虛構,與現實中之團體、機構及捷運公司無關。
        </div>
      </div>
    </div>
  );
}
