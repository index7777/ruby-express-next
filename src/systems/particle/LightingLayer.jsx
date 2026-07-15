// 可重複使用的光效渲染層:吃一個 LightingManager 實例,把目前所有頻道
// (`getAll(now)`)畫成疊在畫面上的全罩層色塊,intensity 已經套用 lighting.js
// 的線性衰減,這裡只負責照著數值畫、不做任何額外的時間判斷。
//
// 渲染方式:每個頻道畫一層 `position: absolute; inset: 0` 的疊層,
// `dangerVignette`/`bossPhaseAlert` 這類「警示」頻道用暗角(radial-gradient,
// 中間透明、邊緣吃色),其餘(如 `comboAura`)用同心的全罩層均勻上色——這只是
// 預設的視覺分類,呼叫端可以用 `vignette` prop 覆蓋單一頻道要不要走暗角畫法。
//
// ── D 類接線(2026-07-16 第四輪):改成直接操作 DOM ref,不再靠 setState 逼重繪 ──
// 跟 `ParticleLayer.jsx`/`FxLayer.jsx` 不一樣,這層不是「每幀節點數會累積」
// 的問題(同時存活的頻道數固定是 `lighting.js` `LIGHTING_PRESETS` 定義的
// 那幾個:`bossPhaseAlert`/`dangerVignette`/`comboAura`,不會無限增加),
// 所以不需要換成 canvas——真正的浪費是原本每幀都呼叫 `setTick()` 強制整個
// 元件重新 render(即使 90% 以上的幀裡這幾個頻道的 intensity 完全沒變),
// 觸發 React reconciliation。改成掛載時就把這 3 個已知頻道的 overlay div
// 一次建好(之後 React 不會再增減這批節點,`CHANNEL_NAMES` 是固定陣列),
// rAF 迴圈裡直接寫 `el.style.xxx`,完全不呼叫 `setState`,這個元件掛載後
// 就不會再觸發任何一次 React re-render。
// ⚠️ 範圍邊界:`CHANNEL_NAMES` 是目前 `lighting.js` `LIGHTING_PRESETS` 用到
// 的全部頻道名稱,寫死列舉而不是動態讀 `getAll()` 的 key——如果之後新增
// 一個全新頻道名稱卻忘記加進這個陣列,那個頻道會被觸發但畫不出來(不會
// 報錯,只是視覺上沒反應)。這是刻意的簡化(換掉「動態頻道數量」以避免
// 又要處理「新頻道出現時要不要觸發 React 掛載新節點」這個更複雂的問題),
// 之後新增頻道時記得同步更新這個陣列。
import { useEffect, useRef } from "react";

const CHANNEL_NAMES = ["bossPhaseAlert", "dangerVignette", "comboAura"];
const DEFAULT_VIGNETTE_CHANNELS = new Set(["bossPhaseAlert", "dangerVignette"]);

export default function LightingLayer({ lighting, style, vignetteChannels = DEFAULT_VIGNETTE_CHANNELS }) {
  const elsRef = useRef({});
  const rafRef = useRef(null);

  useEffect(() => {
    const loop = () => {
      const now = Date.now();
      const channels = lighting.getAll(now);
      for (const name of CHANNEL_NAMES) {
        const el = elsRef.current[name];
        if (!el) continue;
        const ch = channels[name];
        const intensity = ch ? ch.intensity : 0;
        if (intensity <= 0) {
          el.style.opacity = "0";
          continue;
        }
        const isVignette = vignetteChannels.has(name);
        el.style.background = isVignette
          ? `radial-gradient(ellipse at center, transparent 40%, ${ch.color} 140%)`
          : ch.color;
        el.style.opacity = String(intensity);
        el.style.mixBlendMode = isVignette ? "normal" : "screen";
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lighting, vignetteChannels]);

  return (
    <div style={{ position: "relative", pointerEvents: "none", overflow: "hidden", ...style }}>
      {CHANNEL_NAMES.map((name) => (
        <div
          key={name}
          ref={(el) => { elsRef.current[name] = el; }}
          style={{ position: "absolute", inset: 0, opacity: 0 }}
        />
      ))}
    </div>
  );
}
