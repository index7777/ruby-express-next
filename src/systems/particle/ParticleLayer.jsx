// 可重複使用的粒子渲染層:吃一個 ParticleManager 實例,自己用
// requestAnimationFrame 跑「update(dt) + prune()」迴圈並觸發重繪,畫面顯示
// 目前存活的粒子。呼叫端只要疊一層 <ParticleLayer pm={particleManagerRef.current} />
// 在對應畫面上,呼叫 pm.emit(...) / emitParticlePreset(pm, ...) 就會自動飛出去、
// 自動消散,不用各自管理 rAF/setTimeout。
//
// 跟 `effect/FxLayer.jsx` 刻意做成同樣的「傳入 manager + 自跑 rAF + setTick 強制
// 重繪」結構,方便之後維護的人一眼看懂兩層渲染層是同一套模式;差異只在
// FxLayer 只需要呼叫 `fx.prune(now)`(有沒有過期由 manager 自己算 now - bornAt),
// 這裡的 ParticleManager 是「位移模擬」,需要呼叫端把 dt(秒)算給
// `pm.update(dt)`,所以迴圈要多算一個「距離上一幀經過多少毫秒」。
//
// 座標系:x/y 視為容器內的像素座標(跟 particleManager.js 的 vx/vy 單位「每秒
// 像素」對應),呼叫端負責讓容器大小/座標原點跟 emit() 時傳入的 x/y 一致
// (通常是外層容器加 `position: relative`,粒子在容器內用絕對定位)。
//
// ── D 類接線(2026-07-16 第四輪):改用 Canvas 渲染 ──
// 原本每顆存活粒子是一個獨立 absolute-positioned div,combo 里程碑/爆炸
// 這類噴發常態一次多達幾十顆同時存活,且不像音符/彈幕那樣數量有上限——
// 是這個專案目前 DOM 節點churn 最嚴重的一層。改成單一 `<canvas>` 每幀用
// `ctx.arc()+shadowBlur` 畫,不再產生任何 DOM 節點,渲染邏輯(半徑/顏色/
// 透明度/旋轉/縮放跟發光陰影)逐一還原原本 CSS 版本的視覺,只是手法換了,
// `particleManager.js` 本身的物理模擬完全不變。畫布尺寸跟隨外層容器的
// `getBoundingClientRect()`,每幀量測一次(跟 `PlayScene.jsx`/
// `BossScene.jsx` 的 `drawField()`/`drawBossField()` 同一種做法),容器
// 大小變動(例如視窗縮放)下一幀就會自動跟上,不需要額外的 ResizeObserver。
import { useEffect, useRef } from "react";

export default function ParticleLayer({ pm, style }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(null);
  const lastRef = useRef(null);

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
    for (const p of pm.getActive()) {
      const life = Math.max(0, Math.min(1, p.life));
      if (life <= 0) continue;
      const scale = 0.6 + life * 0.4;
      ctx.save();
      ctx.globalAlpha = life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotate);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.1, p.size * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  useEffect(() => {
    lastRef.current = null;
    const loop = (now) => {
      const last = lastRef.current;
      lastRef.current = now;
      // 第一幀沒有「上一幀」可以算 dt,跳過 update 避免一次跳一大步(常見於
      // 分頁切走再切回來、或這個 layer 剛掛載的第一幀)。
      if (last != null) {
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        pm.update(dt);
      }
      pm.prune();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pm]);

  return (
    <div ref={containerRef} style={{ position: "relative", pointerEvents: "none", overflow: "hidden", ...style }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
