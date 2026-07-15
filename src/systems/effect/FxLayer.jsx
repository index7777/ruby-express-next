// 可重複使用的 FX 渲染層:吃一個 FxManager 實例,自己用 requestAnimationFrame
// 跑渲染迴圈(prune 過期特效 + 觸發重繪),畫面顯示目前存活的特效。
// Judge/Boss/Scene 之後要顯示打擊特效,直接疊一層 <FxLayer fx={fxManagerRef.current} />
// 在對應畫面上,呼叫 fx.spawn(...) 就會自動出現、自動消失,不用各自管理 setTimeout。
//
// ── D 類接線(2026-07-16 第四輪):改用 Canvas 渲染 ──
// 原本每個存活特效(PERFECT/GREAT/GOOD/MISS 判定飄字、爆炸/spark 等)是
// 一個獨立 absolute-positioned 文字 div,連段密集時同時存活的飄字數量會
// 疊加——改成單一 `<canvas>` 每幀用 `ctx.fillText()+shadowBlur` 畫文字/
// emoji,不再產生任何 DOM 節點,位置/縮放/淡出/發光邏輯逐一還原原本 CSS
// 版本的視覺,只是手法換了。⚠️ canvas 的 emoji 字形渲染品質視瀏覽器/
// 作業系統內建字型而定,跟原本瀏覽器原生 emoji 渲染可能有些微差異(這是
// canvas 文字渲染的已知限制,不是這次接線的邏輯錯誤),可接受的近似。
import { useEffect, useRef } from "react";

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
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(null);

  const draw = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w <= 0 || h <= 0) return;
    if (canvasSizeRef.current.w !== w || canvasSizeRef.current.h !== h) {
      canvas.width = w; canvas.height = h;
      canvasSizeRef.current = { w, h };
    }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const now = Date.now();
    for (const it of fx.getActive()) {
      const total = Math.max(1, it.expiresAt - it.bornAt);
      const life = Math.max(0, Math.min(1, (it.expiresAt - now) / total));
      if (life <= 0) continue;
      const x = it.data.x ?? 50, y = it.data.y ?? 50;
      const color = FX_COLOR[it.type] || "#fff";
      const fontSize = it.type === "explosion" || it.type === "shockwave" ? 30 : 16;
      const label = FX_LABEL[it.type] || it.type;
      const px = (x / 100) * w;
      const py = (y / 100) * h + (1 - life) * -24;
      const scale = 0.7 + life * 0.5;
      ctx.save();
      ctx.globalAlpha = life;
      ctx.translate(px, py);
      ctx.scale(scale, scale);
      ctx.font = `800 ${fontSize}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  };

  useEffect(() => {
    const loop = () => {
      fx.prune(Date.now());
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fx]);

  return (
    <div ref={containerRef} style={{ position: "relative", pointerEvents: "none", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
