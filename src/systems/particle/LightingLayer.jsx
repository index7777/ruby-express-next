// 可重複使用的光效渲染層:吃一個 LightingManager 實例,把目前所有頻道
// (`getAll(now)`)畫成疊在畫面上的全罩層色塊,intensity 已經套用 lighting.js
// 的線性衰減,這裡只負責照著數值畫、不做任何額外的時間判斷。
//
// 跟 `ParticleLayer.jsx`/`effect/FxLayer.jsx` 同樣的「傳入 manager + 自跑 rAF +
// setTick 強制重繪」結構,差別是這裡沒有位移模擬要算,每幀只是重新讀一次
// `lighting.getAll(now)` 這個純函式的結果,不需要呼叫任何 update()。
//
// 渲染方式:每個頻道畫一層 `position: absolute; inset: 0` 的疊層,
// `dangerVignette`/`bossPhaseAlert` 這類「警示」頻道用暗角(radial-gradient,
// 中間透明、邊緣吃色),其餘(如 `comboAura`)用同心的全罩層均勻上色——這只是
// 預設的視覺分類,呼叫端可以用 `vignette` prop 覆蓋單一頻道要不要走暗角畫法。
import { useEffect, useRef, useState } from "react";

const DEFAULT_VIGNETTE_CHANNELS = new Set(["bossPhaseAlert", "dangerVignette"]);

export default function LightingLayer({ lighting, style, vignetteChannels = DEFAULT_VIGNETTE_CHANNELS }) {
  const [, setTick] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lighting]);

  const now = Date.now();
  const channels = lighting.getAll(now);

  return (
    <div style={{ position: "relative", pointerEvents: "none", overflow: "hidden", ...style }}>
      {Object.entries(channels).map(([name, { intensity, color }]) => {
        if (intensity <= 0) return null;
        const isVignette = vignetteChannels.has(name);
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              inset: 0,
              background: isVignette
                ? `radial-gradient(ellipse at center, transparent 40%, ${color} 140%)`
                : color,
              opacity: intensity,
              mixBlendMode: isVignette ? "normal" : "screen",
            }}
          />
        );
      })}
    </div>
  );
}
