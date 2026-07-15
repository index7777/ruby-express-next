// PlayScene —— Phase 3(Judge 接線)最小可玩判定畫面。
//
// 目的:把獨立、可測試但完全沒有畫面在用的 `judge/gameEngine.js` 真的接上
// 一個可以按鍵盤打的畫面,讓你能實際感受判定手感、耳朵聽到聲音、眼睛看到
// combo 特效與鏡頭震動,而不是只看 node 測試的斷言數字。
//
// ⚠️ 刻意的範圍邊界(不是完整移植 web-build/index.html 的遊戲畫面):
// - 只餵「一般音符」判定路徑(judgeCore 的第 6 段分支),使用
//   `judge/scoring.js` 的 `buildChart()` 備援固定節奏(5 軌、BASE_BPM=100)。
// - 沒有雙軌行李箱音符/炸彈/雜訊/BOSS 分支/NPC/道具/肉鴿卡/平衡對抗——
//   這些 judgeCore 內部邏輯都已經寫好,只是這個場景沒有餵對應的資料/UI,
//   之後真的要做 Phase 8(完整遊戲畫面)接線時才會逐一補上。
// - 按鍵固定用 config 的 `KEY_TO_LANE`(D/F/J/K/L),沒有讀存檔的自訂
//   `laneKeys`(那是行控中心設定頁的功能,不在這次接線範圍內)。
// - 每幀用 setState 強制重繪音符位置,沒有做效能優化(對應 `systems/game/
//   README.md` 講的「主遊戲迴圈重構」,那是完整版 Phase 3 才要做的事,
//   這裡的 tick 迴圈只求「行為正確、能手動測手感」)。
//
// ⚠️ 完全沒有經過瀏覽器實測,詳見 systems/judge/README.md 2026-07-15 章節
// 跟頂層 HANDOFF.md 的待驗證清單。
import { useEffect, useRef, useState } from "react";
import {
  LANES, KEY_TO_LANE, WINDOW_GOOD, APPROACH_SEC, FALL_DISTANCE,
  laneLeftExpr, laneWidthExpr, JUDGE_LABEL, vibrate,
} from "../config/index.js";
import { buildChart } from "../judge/index.js";
import { createGameEngine } from "../judge/gameEngine.js";
import { FxLayer } from "../effect/index.js";
import { applyCameraPreset } from "../camera/index.js";

const CHART_CYCLES = 6; // 16 步/cycle * BEAT_SEC(0.6s) ≈ 9.6 秒/cycle,約 1 分鐘的備援節奏

function laneCenterPercent(lane) {
  return (lane + 0.5) * (100 / LANES.length);
}

// judgeCore 只認得 "perfect"/"great"/"good"/"miss" 這幾種 label,對應
// FxManager 的 FX_DURATIONS/FX_LABEL key 剛好同名(小寫),這裡只需要
// 把 registerHit 吐出的大寫 JUDGE_LABEL 文字轉回 fx type;不認得的文字
// (雙軌/炸彈/雜訊專用,這個場景不會出現)一律 fallback 成 "glow"。
const LABEL_TO_FX = { PERFECT: "perfect", GREAT: "great", GOOD: "good", MISS: "miss" };

export default function PlayScene({ audio, fx, shake, camera, onExit }) {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [stability, setStability] = useState(100);
  const [counts, setCounts] = useState({ perfect: 0, great: 0, good: 0, miss: 0 });
  const [imbalanceActive, setImbalanceActive] = useState(false);
  const [notesSnapshot, setNotesSnapshot] = useState([]);
  const [cameraStyle, setCameraStyle] = useState({});
  const [shakeStyle, setShakeStyle] = useState({});
  const [ended, setEnded] = useState(false);

  const notesRef = useRef([]);
  const chartRef = useRef(null);
  const nextIdxRef = useRef(0);
  const startPerfRef = useRef(null);
  const beatClockRef = useRef(0);
  const rafRef = useRef(null);
  const engineRef = useRef(null);

  const laneCenter = (lane) => `${laneCenterPercent(lane)}%`;

  if (!engineRef.current) {
    engineRef.current = createGameEngine({
      onScoreDelta: (delta) => setScore((s) => s + delta),
      onCountIncrement: (category) => setCounts((c) => ({ ...c, [category]: c[category] + 1 })),
      onComboChange: (next) => { setCombo(next); setMaxCombo((mc) => Math.max(mc, next)); },
      onStabilityChange: (next, _delta, source) => {
        setStability(next);
        if (source === "imbalance-recover") setImbalanceActive(false);
      },
      onNoteConsumed: (noteId) => {
        notesRef.current = notesRef.current.filter((n) => n.id !== noteId);
      },
      onLaneFlash: (lane, category) => {
        fx.spawn(category === "none" ? "glow" : category, { x: laneCenterPercent(lane), y: 86 }, { durationMs: 150 });
      },
      onFloater: (lane, text, _color) => {
        fx.spawn(LABEL_TO_FX[text] || "glow", { x: laneCenterPercent(lane), y: 60 });
      },
      onLaneBurst: (lane) => {
        fx.spawn("spark", { x: laneCenterPercent(lane), y: 86 });
      },
      onPlayDrum: (lane, category) => {
        const laneKey = LANES[lane] ? LANES[lane].key : "kick";
        audio.playDrum(laneKey, category);
      },
      onPlayComboFanfare: () => audio.playComboFanfare(),
      onVibrate: (pattern) => vibrate(pattern),
      onComboMilestoneFx: (tier) => {
        shake.trigger(6 + tier / 15, 260);
        applyCameraPreset(camera, "comboMilestone", tier);
      },
      onSevereImbalanceTriggered: (untilMs) => {
        setImbalanceActive(true);
        const delay = Math.max(0, untilMs - performance.now());
        setTimeout(() => {
          engineRef.current.recoverFromImbalance(performance.now());
        }, delay);
      },
    });
  }

  useEffect(() => {
    audio.ensure(0.8);
    chartRef.current = buildChart(CHART_CYCLES);
    nextIdxRef.current = 0;
    notesRef.current = [];
    startPerfRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      beatClockRef.current = (now - startPerfRef.current) / 1000;
      const t = beatClockRef.current;

      // 從備援譜面掃出「進入下落範圍」的新音符(對應 index.html 2218 行附近)。
      const chart = chartRef.current;
      while (nextIdxRef.current < chart.length && chart[nextIdxRef.current].hitTime - APPROACH_SEC <= t) {
        const c = chart[nextIdxRef.current];
        notesRef.current = [...notesRef.current, { id: c.id, lane: c.lane, hitTime: c.hitTime }];
        nextIdxRef.current += 1;
      }

      // 過期音符(玩家沒按到)自動 miss(對應 index.html 2420 行)。
      const stillAlive = [];
      const expired = [];
      for (const n of notesRef.current) {
        if (t > n.hitTime + WINDOW_GOOD) expired.push(n); else stillAlive.push(n);
      }
      if (expired.length) {
        notesRef.current = stillAlive;
        for (const n of expired) engineRef.current.miss(n.lane, true, now);
      }

      setNotesSnapshot(notesRef.current);

      const camState = camera.getState(now);
      setCameraStyle({ transform: `scale(${camState.zoom}) translate(${camState.x}px, ${camState.y}px)` });
      const { x, y, rotate } = shake.getOffset(now);
      setShakeStyle({ transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)` });

      if (nextIdxRef.current >= chart.length && notesRef.current.length === 0) {
        setEnded(true);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onKeyDown = (e) => {
      const laneIdx = KEY_TO_LANE[e.key.toLowerCase()];
      if (laneIdx === undefined) return;
      const now = performance.now();
      const t = (now - startPerfRef.current) / 1000;
      engineRef.current.hit({
        laneIdx, beatTime: t, rawBeatClock: t, nowMs: now, phase: "running",
        notes: notesRef.current, bombs: [], noise: [],
      });
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0D10", color: "#8FE0FF",
      fontFamily: "-apple-system, system-ui, sans-serif", padding: 20,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>共GO · 判定測試場(最小可玩)</div>
          <button onClick={onExit} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #FF9F45", background: "transparent", color: "#FF9F45", fontSize: 12, cursor: "pointer" }}>離開</button>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 8, flexWrap: "wrap" }}>
          <span>分數 <b>{score}</b></span>
          <span>Combo <b style={{ color: "#FFD700" }}>{combo}</b></span>
          <span>最大連段 {maxCombo}</span>
          <span>P{counts.perfect} G{counts.great} Gd{counts.good} M{counts.miss}</span>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>穩定度 {stability.toFixed(0)}{imbalanceActive ? "(嚴重失衡中,輸入鎖定)" : ""}</div>
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <div style={{
              width: `${stability}%`, height: "100%",
              background: imbalanceActive ? "#FF3B3B" : stability > 50 ? "#59E38C" : "#FFD700",
              transition: "width 0.15s linear",
            }} />
          </div>
        </div>

        <div style={{
          position: "relative", height: FALL_DISTANCE + 40, borderRadius: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden", ...shakeStyle,
        }}>
          <div style={{ position: "absolute", inset: 0, ...cameraStyle }}>
            {LANES.map((lane, i) => (
              <div key={lane.key} style={{
                position: "absolute", top: 0, bottom: 0,
                left: `calc(${laneLeftExpr(i)})`, width: `calc(${laneWidthExpr})`,
                background: lane.track, opacity: 0.35,
                borderLeft: "1px solid rgba(255,255,255,0.08)",
              }} />
            ))}
            {/* 判定線 */}
            <div style={{ position: "absolute", left: 0, right: 0, top: FALL_DISTANCE, height: 2, background: "#FFFFFF", opacity: 0.5 }} />
            {notesSnapshot.map((n) => {
              const progress = Math.max(0, Math.min(1.05, 1 - (n.hitTime - beatClockRef.current) / APPROACH_SEC));
              const laneDef = LANES[n.lane];
              return (
                <div key={n.id} style={{
                  position: "absolute",
                  left: `calc(${laneLeftExpr(n.lane)})`, width: `calc(${laneWidthExpr})`,
                  top: progress * FALL_DISTANCE,
                  display: "flex", justifyContent: "center",
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: laneDef.shape === "circle" ? "50%" : 6,
                    background: laneDef.note, boxShadow: `0 0 10px ${laneDef.glow}`,
                  }} />
                </div>
              );
            })}
          </div>
          <FxLayer fx={fx} style={{ position: "absolute", inset: 0 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          {LANES.map((lane) => (
            <div key={lane.key}>{lane.keyChar} · {lane.label}</div>
          ))}
        </div>

        {ended && (
          <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "#7CFFB2" }}>
            備援節奏播完了(這只是最小可玩測試,沒有結算畫面)。
          </div>
        )}
      </div>
    </div>
  );
}
