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
// - 每幀下落位置/彈幕/NPC 清單改成寫進 `viewRef`(一個普通物件,不是 React
//   state)+ 每幀只呼叫一次 `setRenderTick()` 強制重繪一次,渲染時直接讀
//   `viewRef.current.xxx`——跟 `ParticleLayer.jsx`/`LightingLayer.jsx`/
//   `effect/FxLayer.jsx` 同樣的「manager 塞在 ref + 一顆 tick counter 逼
//   重繪」模式,把每幀 5 個以上分開的 `setState` 呼叫收斂成 1 個,見
//   `systems/game/README.md`「主遊戲迴圈重構」章節。分數/combo/穩定度這些
//   本來就是「事件觸發才變」(不是每幀都變)的顯示狀態,沒有必要跟著收斂,
//   繼續用一般 React state 就好。
//   ⚠️ 這仍然不是完整的「game loop 完全脫離 React」重構(那需要換成
//   Canvas/WebGL 渲染,React 完全不參與每幀更新,是更大的另一個工程),
//   這裡做的是「減少每幀重複的 setState 呼叫次數」這個較小、較安全的優化,
//   詳見 `systems/game/README.md` 的說明。
//
// ── 2026-07-15 接線更新(Particle/Lighting/UI/NPC)──
// 這次把原本各自獨立、只有 node 測試驗證過的 Phase 7(Particle/Lighting)/
// Phase 8(UI)/Phase 9(NPC)系統真的接進這個畫面(BOSS 系統接線見新增的
// `BossScene.jsx`,NPC 只在一般判定場出現,概念上跟原始碼一致——BOSS 戰
// 是獨立的特殊階段,不會同時有一般 NPC 事件)。詳見下方程式碼註解跟
// `systems/game/README.md`「這次刻意沒做的部分」。
import { useEffect, useRef, useState } from "react";
import {
  LANES, KEY_TO_LANE, WINDOW_GOOD, APPROACH_SEC, FALL_DISTANCE,
  laneLeftExpr, laneWidthExpr, JUDGE_LABEL, vibrate,
} from "../config/index.js";
import { buildChart } from "../judge/index.js";
import { createGameEngine } from "../judge/gameEngine.js";
import { FxLayer } from "../effect/index.js";
import { applyCameraPreset } from "../camera/index.js";
import {
  createParticleManager, emitParticlePreset,
  createLightingManager, applyLightingPreset,
  ParticleLayer, LightingLayer,
} from "../particle/index.js";
import { createNpcManager } from "../npc/index.js";
import { Button, ProgressBar } from "../ui/index.js";

const CHART_CYCLES = 6; // 16 步/cycle * BEAT_SEC(0.6s) ≈ 9.6 秒/cycle,約 1 分鐘的備援節奏
const NPC_ROLL_INTERVAL_MS = 3000; // 對照原始碼 npcRollTimerRef 的抽選間隔

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
  const [ended, setEnded] = useState(false);
  // 每幀都會變的畫面資料收在這裡(不是 React state),渲染時直接讀
  // `viewRef.current.xxx`,只靠 `renderTick` 這一顆 state 觸發重繪。
  const viewRef = useRef({ notes: [], bombs: [], noise: [], npcs: [], cameraStyle: {}, shakeStyle: {} });
  const [, setRenderTick] = useState(0);
  const bumpRender = () => setRenderTick((t) => (t + 1) % 1000000);

  const notesRef = useRef([]);
  const chartRef = useRef(null);
  const nextIdxRef = useRef(0);
  const startPerfRef = useRef(null);
  const beatClockRef = useRef(0);
  const rafRef = useRef(null);
  const engineRef = useRef(null);
  const fieldBoxRef = useRef(null);
  const streaksRef = useRef({ perfect: 0, greatPlus: 0 });
  const npcRollAtRef = useRef(0);

  const particleRef = useRef(null);
  if (!particleRef.current) particleRef.current = createParticleManager();
  const lightingRef = useRef(null);
  if (!lightingRef.current) lightingRef.current = createLightingManager();
  const npcRef = useRef(null);
  if (!npcRef.current) npcRef.current = createNpcManager();

  const laneCenter = (lane) => `${laneCenterPercent(lane)}%`;

  // 把 lane 換算成容器內的實際像素座標,給 ParticleLayer/LightingLayer 用
  // (兩者吃的是像素座標,不是 FxLayer 用的百分比座標,見兩者 README 的
  // 座標系說明)。抓不到容器尺寸(尚未 mount)時退回一個保守預設值。
  const laneToPx = (lane, yRatio = 0.86) => {
    const rect = fieldBoxRef.current?.getBoundingClientRect();
    const w = rect ? rect.width : 320;
    const h = rect ? rect.height : FALL_DISTANCE + 40;
    return { x: (laneCenterPercent(lane) / 100) * w, y: yRatio * h };
  };

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
      onBombConsumed: (bombId) => { npcRef.current.hitBomb(bombId); },
      onNoiseConsumed: (noiseId) => { npcRef.current.hitNoise(noiseId); },
      onStreaksChanged: (perfectStreak, greatPlusStreak) => {
        streaksRef.current = { perfect: perfectStreak, greatPlus: greatPlusStreak };
      },
      onLaneFlash: (lane, category) => {
        fx.spawn(category === "none" ? "glow" : category, { x: laneCenterPercent(lane), y: 86 }, { durationMs: 150 });
      },
      onFloater: (lane, text, _color) => {
        const type = LABEL_TO_FX[text] || "glow";
        fx.spawn(type, { x: laneCenterPercent(lane), y: 60 });
        // Phase 7 接線:Perfect/Great 判定額外噴一點粒子,呼應
        // `particle/presets.js` 的 perfectHit/greatHit 場景設計。
        if (type === "perfect" || type === "great") {
          const { x, y } = laneToPx(lane, 0.86);
          emitParticlePreset(particleRef.current, type === "perfect" ? "perfectHit" : "greatHit", x, y);
        }
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
        // Phase 7 接線:combo 里程碑同時觸發碎屑噴發 + 金色光暈,呼應
        // `particle/presets.js`/`lighting.js` 註解寫的「三個系統同一時機
        // 一起觸發」設計。
        const { x, y } = laneToPx(2, 0.5); // 中央軌道、畫面中段
        emitParticlePreset(particleRef.current, "comboMilestone", x, y, tier);
        applyLightingPreset(lightingRef.current, "comboAura", tier);
      },
      onSevereImbalanceTriggered: (untilMs) => {
        setImbalanceActive(true);
        applyLightingPreset(lightingRef.current, "dangerVignette");
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

      // ── NPC 接線(Phase 9)── 每 3000ms 嘗試抽一次(對照 npcRollTimerRef),
      // 每幀 tick() 一次拿雜訊/炸彈/雙軌行李箱的生成請求,轉成 hitTime 後
      // 塞進 NpcManager 自己的 bombs/noise 陣列(單一事實來源,不重複維護
      // 一份 PlayScene 自己的複本),雙軌行李箱則塞進 notesRef(因為
      // judgeCore 的雙軌分支本來就是從 `notes` 陣列找,不是獨立陣列)。
      const npc = npcRef.current;
      if (now - npcRollAtRef.current >= NPC_ROLL_INTERVAL_MS) {
        npcRollAtRef.current = now;
        // 注意:讀 engine 內部即時狀態(`getState()` 回傳的是同一份物件,
        // 不是快照),不是閉包裡的 `stability` React state——這個 tick
        // 函式只在掛載時建立一次(見下面 useEffect 的 `[]` deps),用外層
        // state 變數會是舊值(stale closure),讀 engine 內部狀態才會是
        // 當下最新的穩定度。
        const liveStability = engineRef.current.getState().stability;
        const type = npc.rollSpawn(now, { npcWeight: 1, npcCap: 2, stability: liveStability }, Math.random);
        if (type) npc.spawn(type, now, { rand: Math.random });
      }
      const isLaneFree = (lane) =>
        !notesRef.current.some((n) => Math.abs(n.hitTime - t) < 0.35 && (n.lane === lane || n.doubleLane === lane));
      const npcResult = npc.tick(now, { isLaneFree, rand: Math.random });
      for (const req of npcResult.noiseSpawns) npc.noise.push({ ...req, hitTime: t + APPROACH_SEC });
      for (const req of npcResult.bombSpawns) npc.bombs.push({ ...req, hitTime: t + APPROACH_SEC });
      for (const req of npcResult.luggageSpawns) {
        notesRef.current = [...notesRef.current, {
          id: req.id, lane: req.pairStart, doubleLane: req.pairStart + 1,
          hitTime: t + APPROACH_SEC, kind: "double",
        }];
      }
      // 過期的雜訊/炸彈直接消失,不算 miss、不扣分(對照原始碼:讓炸彈安全
      // 飛過才是「正確玩法」,雜訊沒打到也只是損失加分機會,兩者都跟一般
      // 音符的過期規則不同)。
      npc.noise = npc.noise.filter((n) => t <= n.hitTime + WINDOW_GOOD);
      npc.bombs = npc.bombs.filter((b) => t <= b.hitTime + WINDOW_GOOD);

      // 增益 NPC 效果:直接對照 active 清單推導出的「有效到」時間戳,餵給
      // gameEngine 既有的 setBuffXxxUntil() API(這兩個 setter 是 Phase 3
      // 就設計好、專門留給 NPC 系統接線用的,見 `judge/gameEngine.js` 開頭
      // 「刻意不在這裡做的事」段落)。
      const policeNpc = npc.active.find((n) => n.type === "police");
      engineRef.current.setBuffGoodToPerfectUntil(policeNpc ? policeNpc.bornAt + policeNpc.durationMs : 0);
      const conductorNpc = npc.active.find((n) => n.type === "conductor");
      engineRef.current.setBuffMissImmuneUntil(conductorNpc ? conductorNpc.bornAt + conductorNpc.durationMs : 0);

      // 驅散規則(對照 maybeDismissNpc):擴音上班族/亂跑小孩用連續判定
      // 門檻驅散,背包客疊層用另一套較低門檻的連續 Perfect 拍掉。
      const { perfect: perfectStreak, greatPlus: greatPlusStreak } = streaksRef.current;
      for (const n of [...npc.active]) {
        if ((n.type === "phone" || n.type === "kid") && npc.canDismiss(n.type, n.id, now, { perfectStreak, greatPlusStreak })) {
          npc.dismiss(n.id);
        }
      }
      const popped = npc.popBackpackStack(perfectStreak);
      if (popped) setScore((s) => s + popped.scoreDelta);

      // 過期音符(玩家沒按到)自動 miss(對應 index.html 2420 行)。雙軌
      // 行李箱音符(kind==="double")不算譜面音符,對照 isChartNote 規則。
      const stillAlive = [];
      const expired = [];
      for (const n of notesRef.current) {
        if (t > n.hitTime + WINDOW_GOOD) expired.push(n); else stillAlive.push(n);
      }
      if (expired.length) {
        notesRef.current = stillAlive;
        for (const n of expired) engineRef.current.miss(n.lane, n.kind !== "double", now);
      }

      const camState = camera.getState(now);
      const { x: sx, y: sy, rotate } = shake.getOffset(now);
      const view = viewRef.current;
      view.notes = notesRef.current;
      view.bombs = npc.bombs;
      view.noise = npc.noise;
      view.npcs = npc.active.map((n) => ({ id: n.id, type: n.type, remainMs: Math.max(0, n.durationMs - (now - n.bornAt)) }));
      view.cameraStyle = { transform: `scale(${camState.zoom}) translate(${camState.x}px, ${camState.y}px)` };
      view.shakeStyle = { transform: `translate(${sx}px, ${sy}px) rotate(${rotate}deg)` };
      bumpRender();

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
        notes: notesRef.current, bombs: npcRef.current.bombs, noise: npcRef.current.noise,
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
          <Button variant="ghost" onClick={onExit}>離開</Button>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 8, flexWrap: "wrap" }}>
          <span>分數 <b>{score}</b></span>
          <span>Combo <b style={{ color: "#FFD700" }}>{combo}</b></span>
          <span>最大連段 {maxCombo}</span>
          <span>P{counts.perfect} G{counts.great} Gd{counts.good} M{counts.miss}</span>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>穩定度 {stability.toFixed(0)}{imbalanceActive ? "(嚴重失衡中,輸入鎖定)" : ""}</div>
          <ProgressBar value={stability / 100} color={imbalanceActive ? "#FF3B3B" : undefined} />
        </div>

        <div ref={fieldBoxRef} style={{
          position: "relative", height: FALL_DISTANCE + 40, borderRadius: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden", ...viewRef.current.shakeStyle,
        }}>
          <div style={{ position: "absolute", inset: 0, ...viewRef.current.cameraStyle }}>
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
            {viewRef.current.notes.map((n) => {
              const progress = Math.max(0, Math.min(1.05, 1 - (n.hitTime - beatClockRef.current) / APPROACH_SEC));
              const laneDef = LANES[n.lane];
              const isDouble = n.kind === "double";
              return (
                <div key={n.id} style={{
                  position: "absolute",
                  left: `calc(${laneLeftExpr(n.lane)})`,
                  width: isDouble ? `calc(2 * ${laneWidthExpr})` : `calc(${laneWidthExpr})`,
                  top: progress * FALL_DISTANCE,
                  display: "flex", justifyContent: "center",
                }}>
                  <div style={{
                    width: isDouble ? "80%" : 26, height: 26, borderRadius: isDouble ? 6 : (laneDef.shape === "circle" ? "50%" : 6),
                    background: isDouble ? "#FFD43B" : laneDef.note,
                    boxShadow: `0 0 10px ${isDouble ? "#FFD43B" : laneDef.glow}`,
                  }} />
                </div>
              );
            })}
            {viewRef.current.bombs.map((b) => (
              <div key={b.id} style={{
                position: "absolute",
                left: `calc(${laneLeftExpr(b.lane)})`, width: `calc(${laneWidthExpr})`,
                top: Math.max(0, Math.min(1.05, 1 - (b.hitTime - beatClockRef.current) / APPROACH_SEC)) * FALL_DISTANCE,
                display: "flex", justifyContent: "center", fontSize: 20,
              }}>💣</div>
            ))}
            {viewRef.current.noise.map((n) => (
              <div key={n.id} style={{
                position: "absolute",
                left: `calc(${laneLeftExpr(n.lane)})`, width: `calc(${laneWidthExpr})`,
                top: Math.max(0, Math.min(1.05, 1 - (n.hitTime - beatClockRef.current) / APPROACH_SEC)) * FALL_DISTANCE,
                display: "flex", justifyContent: "center", fontSize: 18, opacity: 0.85,
              }}>📶</div>
            ))}
          </div>
          <LightingLayer lighting={lightingRef.current} style={{ position: "absolute", inset: 0 }} />
          <ParticleLayer pm={particleRef.current} style={{ position: "absolute", inset: 0 }} />
          <FxLayer fx={fx} style={{ position: "absolute", inset: 0 }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          {LANES.map((lane) => (
            <div key={lane.key}>{lane.keyChar} · {lane.label}</div>
          ))}
        </div>

        {viewRef.current.npcs.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.75, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {viewRef.current.npcs.map((n) => (
              <span key={n.id}>👤 {n.type}({Math.ceil(n.remainMs / 1000)}s)</span>
            ))}
          </div>
        )}

        {ended && (
          <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: "#7CFFB2" }}>
            備援節奏播完了(這只是最小可玩測試,沒有結算畫面)。
          </div>
        )}
      </div>
    </div>
  );
}
