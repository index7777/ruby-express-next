// 可重複使用的 FX 渲染層:吃一個 FxManager 實例,自己用 requestAnimationFrame
// 跑渲染迴圈(prune 過期特效 + 觸發重繪),畫面顯示目前存活的特效。
// Judge/Boss/Scene 之後要顯示打擊特效,直接疊一層 <FxLayer fx={fxManagerRef.current} />
// 在對應畫面上,呼叫 fx.spawn(...) 就會自動出現、自動消失,不用各自管理 setTimeout。
import { useEffect, useRef, useState } from "react";

const FX_COLOR = {
  perfect: "#FFD700", great: "#63C2FF", good: "#C0C8D0", miss: "#FF2222",
  explosion: "#FF9F45", shockwave: "#8CEEFF", smoke: "#8A939E", spark: "#FFF0A0",
  trail: "#59E38C", glow: "#FFFFFF",
};

const FX_LABEL = {
  perfect: "PERFECT", great: "GREAT", good: "GOOD", miss: "MISS",
  explosion: "💥", shockwave: "◎", smoke: "☁", spark: "✦", trail: "―", glow: "✺",
};

export default function FxLayer({ fx, style }) {
  const [, setTick] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const loop = () => {
      fx.prune(Date.now());
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fx]);

  const items = fx.getActive();

  return (
    <div style={{ position: "relative", pointerEvents: "none", overflow: "hidden", ...style }}>
      {items.map((it) => {
        const now = Date.now();
        const total = Math.max(1, it.expiresAt - it.bornAt);
        const life = Math.max(0, Math.min(1, (it.expiresAt - now) / total));
        const x = it.data.x ?? 50, y = it.data.y ?? 50;
        const color = FX_COLOR[it.type] || "#fff";
        return (
          <div
            key={it.id}
            style={{
              position: "absolute",
              left: `${x}%`, top: `${y}%`,
              transform: `translate(-50%, ${(1 - life) * -24}px) scale(${0.7 + life * 0.5})`,
              opacity: life,
              color,
              fontWeight: 800,
              fontSize: it.type === "explosion" || it.type === "shockwave" ? 30 : 16,
              textShadow: `0 0 10px ${color}`,
              whiteSpace: "nowrap",
            }}
          >
            {FX_LABEL[it.type] || it.type}
          </div>
        );
      })}
    </div>
  );
}
