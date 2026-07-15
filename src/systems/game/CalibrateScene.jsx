// CalibrateScene —— 對照原始碼 `phase==="calibrate"`(index.html
// 4477-4499 行)即時判定校準:音符持續掉落,玩家跟著點「打!」,系統量測
// 「按下當下」跟「音符真正落到判定線那一刻」的時間差,取平均當建議 offset。
//
// ⚠️ 刻意簡化:原始碼的節奏取自遊戲本身的 `BEAT_SEC`(跟正式判定同一套
// 節奏),這裡沿用同一個常數但音符外觀簡化成單一圓點(不分五軌),因為
// 校準只需要「掉落 → 落下時間點」這一件事,不需要模擬五軌判定。
import { useEffect, useRef, useState } from "react";
import { BEAT_SEC, APPROACH_SEC, FALL_DISTANCE } from "../config/index.js";
import MenuLayout from "./MenuLayout.jsx";
import { Button } from "../ui/index.js";

const MAX_SAMPLES = 8;

export default function CalibrateScene({ onApply, onBack }) {
  const [notes, setNotes] = useState([]);
  const [samples, setSamples] = useState([]);
  const [lastLabel, setLastLabel] = useState(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const nextBeatRef = useRef(0);
  const notesRef = useRef([]);

  useEffect(() => {
    startRef.current = performance.now();
    nextBeatRef.current = 1.2; // 第一顆延遲 1.2 秒出現,給玩家準備時間

    const tick = () => {
      const now = performance.now();
      const t = (now - startRef.current) / 1000;

      while (nextBeatRef.current <= t + APPROACH_SEC + 4) {
        notesRef.current = [...notesRef.current, { id: nextBeatRef.current, hitTime: nextBeatRef.current }];
        nextBeatRef.current += BEAT_SEC * 2; // 校准節奏放慢成正常拍子的一半,方便手動點擊
      }
      notesRef.current = notesRef.current.filter((n) => t <= n.hitTime + 1.2);
      setNotes(notesRef.current.map((n) => ({ ...n, progress: Math.max(0, Math.min(1.2, 1 - (n.hitTime - t) / APPROACH_SEC)) })));

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const calibHit = () => {
    const now = performance.now();
    const t = (now - startRef.current) / 1000;
    if (notesRef.current.length === 0) return;
    // 找離現在最近的音符(不管早或晚),對照原始碼「取最接近的一顆算誤差」。
    let best = notesRef.current[0];
    for (const n of notesRef.current) {
      if (Math.abs(n.hitTime - t) < Math.abs(best.hitTime - t)) best = n;
    }
    const deltaMs = (t - best.hitTime) * 1000;
    notesRef.current = notesRef.current.filter((n) => n.id !== best.id);
    setLastLabel(deltaMs > 0 ? { label: "偏慢", color: "#FF9F45" } : { label: "偏快", color: "#3FE0FF" });
    setSamples((s) => [...s.slice(-(MAX_SAMPLES - 1)), deltaMs]);
  };

  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;

  return (
    <MenuLayout title="即時校準" onBack={onBack}>
      <div style={{ fontSize: 12, color: "#C0C8D0", lineHeight: 1.7, marginBottom: 4 }}>
        跟著白色音符落到底線時,點下方「打!」。連點幾下後系統會算出建議 offset,可直接套用。
      </div>

      <div style={{
        position: "relative", height: FALL_DISTANCE * 0.5 + 30, borderRadius: 12,
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, height: 2, background: "#fff", opacity: 0.6 }} />
        {notes.map((n) => (
          <div key={n.id} style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            top: n.progress * (FALL_DISTANCE * 0.5),
            width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 0 10px #fff",
          }} />
        ))}
        {lastLabel && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: lastLabel.color, pointerEvents: "none" }}>
            {lastLabel.label}
          </div>
        )}
      </div>

      <Button variant="primary" style={{ width: "100%", padding: "16px 0", fontSize: 16 }} onClick={calibHit}>打!</Button>

      <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center" }}>
        {avg != null
          ? `已取樣 ${samples.length} · 平均誤差 ${avg > 0 ? "+" : ""}${Math.round(avg)}ms(${avg > 0 ? "偏慢" : "偏快"})`
          : "尚未取樣"}
      </div>

      {avg != null && samples.length >= 3 && (
        <Button
          variant="primary"
          style={{ width: "100%" }}
          onClick={() => onApply(Math.max(-150, Math.min(150, Math.round(avg))))}
        >
          套用 {Math.round(avg) > 0 ? "+" : ""}{Math.round(avg)}ms
        </Button>
      )}
    </MenuLayout>
  );
}
