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
import { useEffect, useRef, useState } from "react";

export default function ParticleLayer({ pm, style }) {
  const [, setTick] = useState(0);
  const rafRef = useRef(null);
  const lastRef = useRef(null);

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
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pm]);

  const items = pm.getActive();

  return (
    <div style={{ position: "relative", pointerEvents: "none", overflow: "hidden", ...style }}>
      {items.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x, top: p.y,
            width: p.size * 2, height: p.size * 2,
            marginLeft: -p.size, marginTop: -p.size,
            borderRadius: "50%",
            background: p.color,
            opacity: Math.max(0, Math.min(1, p.life)),
            transform: `rotate(${p.rotate}rad) scale(${0.6 + p.life * 0.4})`,
            boxShadow: `0 0 ${p.size}px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
