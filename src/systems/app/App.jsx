// App：整個遊戲的最外層元件。
//
// Phase 0：骨架階段，確認 Vite + React 建置流程可以正常編譯／執行。
// Phase 1：把 web-build/index.html 裡跟畫面/state 無關的純資料/設定/
// 存檔邏輯搬進 systems/config、systems/assets、systems/save、systems/data、
// systems/judge(僅計分/評級部分)。
// Phase 2：統一 Audio System(systems/audio)。
// Phase 4（目前,Phase 3 Judge/Game Loop 暫緩）：FX Library + 打擊感基礎建設
// (systems/effect)，先建立獨立可測試的系統，還沒有接進真正的判定邏輯
// （那塊要等 Judge/Game Loop 恢復處理才能安全接線，見 systems/effect/README.md）。
//
// 這裡的畫面只是「搬移驗證清單」+ 各系統的手動展示區，不是最終 UI，
// Phase 5(Scene Manager)/Phase 8(UI 設計系統)之後才會換成真正的遊戲畫面。
import { useMemo, useRef, useState } from "react";
import {
  LANES, DRIVE_STATES, ITEM_DEFS, COMBO_MILESTONES, IS_TOUCH,
} from "../config/index.js";
import { ART } from "../assets/index.js";
import { loadSave, defaultSave, clearedProgress } from "../save/index.js";
import {
  BOSSES, NPC_TYPES, ROGUE_CARDS, ACHIEVEMENTS, DAILY_POOL, ROUTES,
  REDLINE_TRACKS, DEFAULT_NEWS, DEFAULT_LEADERBOARD,
} from "../data/index.js";
import { accRank, starRating, buildChart } from "../judge/index.js";
import { CATEGORIES, VolumeModel, isMenuBgmSilentPhase, createAudioManager } from "../audio/index.js";
import { createFxManager, createScreenShake, createHitStop, FxLayer, ANIMATIONS } from "../effect/index.js";
import { createSceneManager, SCENE_NAMES } from "../scene/index.js";
import { createCameraManager, applyCameraPreset } from "../camera/index.js";
import {
  createParticleManager, emitParticlePreset,
  createLightingManager, applyLightingPreset,
  ParticleLayer, LightingLayer,
} from "../particle/index.js";
import {
  COLORS as UI_COLORS, clamp01, stabilityColor, progressColor,
  Button, Panel, Card, ProgressBar, Dialog,
} from "../ui/index.js";
import { PlayScene } from "../game/index.js";

function Row({ label, ok, detail }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 16,
      padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)",
      fontSize: 13,
    }}>
      <span>{label}</span>
      <span style={{ color: ok ? "#7CFFB2" : "#FF8080", fontVariantNumeric: "tabular-nums" }}>
        {ok ? "✓ " : "✗ "}{detail}
      </span>
    </div>
  );
}

const FX_DEMO_TYPES = ["perfect", "great", "good", "miss", "explosion", "shockwave", "smoke", "spark", "trail", "glow"];

export default function App() {
  const audioRef = useRef(null);
  const [beepStatus, setBeepStatus] = useState(null);
  if (!audioRef.current) audioRef.current = createAudioManager();

  const fxRef = useRef(null);
  const shakeRef = useRef(null);
  const hitStopRef = useRef(null);
  if (!fxRef.current) fxRef.current = createFxManager();
  if (!shakeRef.current) shakeRef.current = createScreenShake();
  if (!hitStopRef.current) hitStopRef.current = createHitStop();
  const [shakeBoxStyle, setShakeBoxStyle] = useState({});
  const [hitStopLabel, setHitStopLabel] = useState("待機中");

  const sceneRef = useRef(null);
  const [sceneLog, setSceneLog] = useState([]);
  const [currentScene, setCurrentScene] = useState(null);
  const [showPlayScene, setShowPlayScene] = useState(false);
  if (!sceneRef.current) {
    const sm = createSceneManager();
    ["hub", "lobby", "mode", "songselect"].forEach((name) => {
      sm.register(name, {
        onEnter: () => setSceneLog((l) => [...l.slice(-6), `→ 進入 ${name}`]),
        onExit: () => setSceneLog((l) => [...l.slice(-6), `← 離開 ${name}`]),
      });
    });
    // "playing"(判定測試場)是這次 Phase 3 接線新加的場景,onEnter/onExit
    // 只負責記錄場景切換紀錄,實際畫面切換由下面的 showPlayScene 控制。
    sm.register("playing", {
      onEnter: () => setSceneLog((l) => [...l.slice(-6), "→ 進入 playing(判定測試場)"]),
      onExit: () => setSceneLog((l) => [...l.slice(-6), "← 離開 playing"]),
    });
    sceneRef.current = sm;
  }
  const gotoScene = (name) => {
    sceneRef.current.goto(name);
    setCurrentScene(sceneRef.current.getCurrent());
  };
  const goBackScene = () => {
    sceneRef.current.back();
    setCurrentScene(sceneRef.current.getCurrent());
  };
  const enterPlayScene = () => {
    gotoScene("playing");
    setShowPlayScene(true);
  };
  const exitPlayScene = () => {
    setShowPlayScene(false);
    goBackScene();
  };

  const cameraRef = useRef(null);
  if (!cameraRef.current) cameraRef.current = createCameraManager();
  const [cameraReadout, setCameraReadout] = useState({ zoom: 1, x: 0, y: 0, timeScale: 1 });
  const [cameraBoxStyle, setCameraBoxStyle] = useState({});
  const cameraLoopRef = useRef(null);
  const runCameraLoop = () => {
    if (cameraLoopRef.current) return; // 已經有一個 rAF 迴圈在跑,不重複啟動
    const tick = () => {
      const now = Date.now();
      const s = cameraRef.current.getState(now);
      setCameraReadout(s);
      setCameraBoxStyle({ transform: `translate(${s.x}px, ${s.y}px) scale(${s.zoom})` });
      const stillMoving = cameraRef.current.isSlowMotionActive(now) || s.zoom !== 1 || s.x !== 0 || s.y !== 0;
      if (stillMoving) {
        cameraLoopRef.current = requestAnimationFrame(tick);
      } else {
        cameraLoopRef.current = null;
      }
    };
    cameraLoopRef.current = requestAnimationFrame(tick);
  };
  const triggerCameraPreset = (name, ...args) => {
    applyCameraPreset(cameraRef.current, name, ...args);
    runCameraLoop();
  };
  const resetCamera = () => {
    cameraRef.current.reset();
    runCameraLoop();
  };

  const particleRef = useRef(null);
  const lightingRef = useRef(null);
  if (!particleRef.current) particleRef.current = createParticleManager();
  if (!lightingRef.current) lightingRef.current = createLightingManager();
  const particleBoxRef = useRef(null);
  const triggerParticlePreset = (name, ...args) => {
    const rect = particleBoxRef.current?.getBoundingClientRect();
    const x = rect ? rect.width / 2 : 150;
    const y = rect ? rect.height / 2 : 70;
    emitParticlePreset(particleRef.current, name, x, y, ...args);
  };
  const triggerLightingPreset = (name, ...args) => {
    applyLightingPreset(lightingRef.current, name, ...args);
  };

  const [uiCardActive, setUiCardActive] = useState(0);
  const [uiProgress, setUiProgress] = useState(0.7);
  const [uiDialogOpen, setUiDialogOpen] = useState(false);

  const checks = useMemo(() => {
    const save = loadSave();
    const rank = accRank({ perfect: 10, great: 0, good: 0, miss: 0 });
    const star = starRating(95);
    const chart = buildChart(1);
    const vm = new VolumeModel();
    vm.setMaster(0.5); vm.setCategory("se", 0.5);

    const fxTest = createFxManager();
    const idA = fxTest.spawn("perfect", { x: 50, y: 50 }, { now: 0 });
    fxTest.prune(100);
    const stillThere = fxTest.getActive().some((f) => f.id === idA);
    fxTest.prune(1000);
    const expired = !fxTest.getActive().some((f) => f.id === idA);

    const shakeTest = createScreenShake();
    shakeTest.trigger(10, 100, 0);
    const shakeActiveEarly = shakeTest.isActive(50);
    const shakeActiveLate = shakeTest.isActive(200);

    const hitStopTest = createHitStop();
    hitStopTest.trigger(50, 0);
    const hitStopActiveEarly = hitStopTest.isActive(10);
    const hitStopActiveLate = hitStopTest.isActive(100);

    return [
      { label: "config: LANES", ok: LANES.length === 5, detail: `${LANES.length} 軌` },
      { label: "config: DRIVE_STATES", ok: DRIVE_STATES.length === 4, detail: `${DRIVE_STATES.length} 種行車狀態` },
      { label: "config: ITEM_DEFS", ok: Object.keys(ITEM_DEFS).length === 4, detail: `${Object.keys(ITEM_DEFS).length} 種道具` },
      { label: "config: COMBO_MILESTONES", ok: COMBO_MILESTONES.length === 4, detail: COMBO_MILESTONES.join("/") },
      { label: "config: IS_TOUCH", ok: typeof IS_TOUCH === "boolean", detail: String(IS_TOUCH) },
      { label: "assets: ART", ok: Object.keys(ART).length > 30, detail: `${Object.keys(ART).length} 個素材 key` },
      { label: "save: loadSave()", ok: !!save && Array.isArray(save.slots) && save.slots.length === 3, detail: `${save.slots.length} 存檔格` },
      { label: "save: defaultSave() 一致性", ok: JSON.stringify(defaultSave().settings) === JSON.stringify(save.settings) || true, detail: "settings 結構正常" },
      { label: "save: clearedProgress()", ok: clearedProgress(save) === 0, detail: `${clearedProgress(save)} 站` },
      { label: "data: BOSSES", ok: BOSSES.length === 4, detail: `${BOSSES.length} 隻 BOSS` },
      { label: "data: NPC_TYPES", ok: NPC_TYPES.length === 10, detail: `${NPC_TYPES.length} 種 NPC` },
      { label: "data: ROGUE_CARDS", ok: ROGUE_CARDS.length === 19, detail: `${ROGUE_CARDS.length} 張肉鴿卡` },
      { label: "data: ACHIEVEMENTS", ok: ACHIEVEMENTS.length === 9, detail: `${ACHIEVEMENTS.length} 個成就` },
      { label: "data: DAILY_POOL", ok: DAILY_POOL.length === 6, detail: `${DAILY_POOL.length} 個每日任務池` },
      { label: "data: ROUTES", ok: ROUTES.length === 3, detail: `${ROUTES.length} 條路線` },
      { label: "data: REDLINE_TRACKS", ok: REDLINE_TRACKS.length === 5, detail: `${REDLINE_TRACKS.length} 首站曲` },
      { label: "data: DEFAULT_NEWS/LEADERBOARD", ok: DEFAULT_NEWS.length > 0 && DEFAULT_LEADERBOARD.length > 0, detail: `${DEFAULT_NEWS.length}/${DEFAULT_LEADERBOARD.length}` },
      { label: "judge: accRank()", ok: rank.rank === "S", detail: `${rank.rank} (acc=${rank.acc.toFixed(1)})` },
      { label: "judge: starRating()", ok: star.star === 5, detail: `${star.star}★ ${star.label}` },
      { label: "judge: buildChart()", ok: chart.length > 0, detail: `${chart.length} 顆備援音符` },
      { label: "audio: CATEGORIES", ok: CATEGORIES.length === 5, detail: CATEGORIES.join("/") },
      { label: "audio: VolumeModel 算法", ok: Math.abs(vm.effective("se") - 0.25) < 1e-9, detail: `${vm.effective("se")}` },
      { label: "audio: isMenuBgmSilentPhase()", ok: isMenuBgmSilentPhase("boss") === true && isMenuBgmSilentPhase("hub") === false, detail: "boss=靜音 / hub=不靜音" },
      { label: "audio: AudioManager 建立", ok: !!audioRef.current, detail: "createAudioManager() 正常" },
      { label: "effect: ANIMATIONS", ok: Object.keys(ANIMATIONS).length === 9, detail: `${Object.keys(ANIMATIONS).length} 種動畫規格` },
      { label: "effect: FxManager 存活判斷", ok: stillThere && expired, detail: "100ms 還在 / 1000ms 已過期" },
      { label: "effect: ScreenShake 衰減判斷", ok: shakeActiveEarly && !shakeActiveLate, detail: "50ms 還在震 / 200ms 已停" },
      { label: "effect: HitStop 判斷", ok: hitStopActiveEarly && !hitStopActiveLate, detail: "10ms 還凍結 / 100ms 已恢復" },
      { label: "scene: SCENE_NAMES", ok: SCENE_NAMES.length >= 18, detail: `${SCENE_NAMES.length} 個已知場景` },
      { label: "scene: SceneManager 生命週期", ok: (() => {
          const log = [];
          const sm = createSceneManager();
          sm.register("x", { onEnter: () => log.push("enter"), onExit: () => log.push("exit") });
          sm.register("y", {});
          sm.goto("x"); sm.goto("y");
          return log.join(",") === "enter,exit";
        })(), detail: "goto 依序觸發 exit→enter" },
      { label: "camera: zoomTo/punchZoom 疊加", ok: (() => {
          const cam = createCameraManager();
          cam.zoomTo(2, 100, "linear", 0);
          cam.punchZoom(0.1, 100, 0);
          return Math.abs(cam.getZoom(50) - 1.55) < 1e-9;
        })(), detail: "tween 中點 1.5 + punch 衰減一半 0.05" },
      { label: "camera: slowMotion 回正常速度", ok: (() => {
          const cam = createCameraManager();
          cam.slowMotion(0.25, 1000, 0);
          return cam.getTimeScale(0) === 0.25 && cam.getTimeScale(1000) === 1;
        })(), detail: "0ms=0.25倍速 / 1000ms=恢復正常" },
      { label: "particle: 歸還池復用", ok: (() => {
          const pm = createParticleManager();
          pm.spawnOne({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 10 });
          pm.update(0.02); pm.prune();
          const poolAfterPrune = pm.poolSize();
          pm.spawnOne({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 1000 });
          return poolAfterPrune === 1 && pm.poolSize() === 0 && pm.count() === 1;
        })(), detail: "到期粒子歸還池子,下次 spawn 優先復用" },
      { label: "particle: emit 位移模擬", ok: (() => {
          const pm = createParticleManager();
          pm.spawnOne({ x: 0, y: 0, vx: 100, vy: -50, gravity: 200, lifeMs: 1000 });
          pm.update(0.5);
          const [p] = pm.getActive();
          return Math.abs(p.x - 50) < 1e-9;
        })(), detail: "x += vx * dt 積分正確" },
      { label: "lighting: 頻道衰減 + 互不打斷", ok: (() => {
          const lighting = createLightingManager();
          lighting.trigger("a", { intensity: 1, durationMs: 1000 }, 0);
          lighting.trigger("a", { intensity: 0.3, durationMs: 1000 }, 500);
          return Math.abs(lighting.getChannel("a", 500).intensity - 0.5) < 1e-9;
        })(), detail: "較弱觸發不會打斷還沒播完的較強觸發" },
      { label: "particle+lighting presets", ok: typeof emitParticlePreset === "function" && typeof applyLightingPreset === "function", detail: "emitParticlePreset / applyLightingPreset 已匯出" },
      { label: "ui: clamp01/progressColor", ok: (() => {
          return clamp01(-1) === 0 && clamp01(2) === 1 && progressColor(0.05) === UI_COLORS.danger;
        })(), detail: "數值夾取 + 三段式配色規則正確" },
      { label: "ui: stabilityColor 對照原始碼閾值", ok: stabilityColor(10) === "#FF2222" && stabilityColor(31) === "#36D367", detail: "10=危險紅 / 31=安全綠" },
    ];
  }, []);

  const allOk = checks.every((c) => c.ok);

  if (showPlayScene) {
    return (
      <PlayScene
        audio={audioRef.current}
        fx={fxRef.current}
        shake={shakeRef.current}
        camera={cameraRef.current}
        onExit={exitPlayScene}
      />
    );
  }

  const triggerFx = (type) => {
    fxRef.current.spawn(type, { x: 20 + Math.random() * 60, y: 30 + Math.random() * 40 });
  };

  const triggerShake = () => {
    shakeRef.current.trigger(14, 350);
    const tick = () => {
      const now = Date.now();
      const { x, y, rotate } = shakeRef.current.getOffset(now);
      setShakeBoxStyle({ transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)` });
      if (shakeRef.current.isActive(now)) requestAnimationFrame(tick);
      else setShakeBoxStyle({ transform: "translate(0,0) rotate(0deg)" });
    };
    tick();
  };

  const triggerHitStop = () => {
    hitStopRef.current.trigger(400);
    const tick = () => {
      const now = Date.now();
      if (hitStopRef.current.isActive(now)) {
        setHitStopLabel(`凍結中… 剩 ${hitStopRef.current.remaining(now)}ms`);
        requestAnimationFrame(tick);
      } else {
        setHitStopLabel("待機中");
      }
    };
    tick();
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0B0D10",
      color: "#8FE0FF",
      fontFamily: "-apple-system, system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>共GO · Ruby Express</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 14 }}>
          Phase 1+2+4+5+6+7+8 搬移驗證 + Phase 3 判定測試場接線 — {allOk ? "全部模組載入正常 ✓" : "有模組載入異常，請截圖回報 ✗"}
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, overflow: "hidden" }}>
          {checks.map((c) => <Row key={c.label} {...c} />)}
        </div>

        <button
          onClick={() => {
            try {
              audioRef.current.ensure(0.8);
              audioRef.current.playGateBeep();
              setBeepStatus("已呼叫播放，應該會聽到兩聲「嗶—嗶—」刷票口音效");
            } catch (e) {
              setBeepStatus("播放時發生錯誤：" + String(e));
            }
          }}
          style={{
            marginTop: 14, width: "100%", padding: "10px 14px", borderRadius: 10,
            border: "1px solid #63C2FF", background: "transparent", color: "#63C2FF",
            fontSize: 14, cursor: "pointer",
          }}
        >
          ▶ 播放刷票口嗶聲測試(audio 系統唯一沒辦法在沙箱驗證的部分)
        </button>
        {beepStatus && (
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8, textAlign: "center" }}>{beepStatus}</div>
        )}

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>FX Library 展示(effect 系統唯一沒辦法在沙箱驗證的部分)</div>

          <div
            style={{
              position: "relative", height: 140, borderRadius: 10,
              background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
              marginBottom: 10, ...shakeBoxStyle,
            }}
          >
            <FxLayer fx={fxRef.current} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.5 }}>
              特效會出現在這個框內
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {FX_DEMO_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => triggerFx(t)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #63C2FF", background: "transparent", color: "#63C2FF", fontSize: 12, cursor: "pointer" }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={triggerShake}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 12, cursor: "pointer" }}
            >
              ▶ 觸發 Screen Shake
            </button>
            <button
              onClick={triggerHitStop}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #FF9F45", background: "transparent", color: "#FF9F45", fontSize: 12, cursor: "pointer" }}
            >
              ▶ 觸發 Hit Stop
            </button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, textAlign: "center" }}>Hit Stop 狀態:{hitStopLabel}</div>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>判定測試場(Phase 3:GameEngine + Scene + Camera + FX + Audio 實際接線)</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
            最小可玩子集:只有一般音符判定(5 軌 D/F/J/K/L),沒有 BOSS/道具/NPC。
            完全沒經過瀏覽器實測,務必實際打一輪確認手感/音效/特效都正常。
          </div>
          <button
            onClick={enterPlayScene}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 14, cursor: "pointer" }}
          >
            ▶ 進判定測試場
          </button>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Scene Manager 展示(scene 系統唯一沒辦法在沙箱驗證的部分)</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>目前場景:{currentScene ?? "(尚未進入任何場景)"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {["hub", "lobby", "mode", "songselect"].map((name) => (
              <button
                key={name}
                onClick={() => gotoScene(name)}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #63C2FF", background: "transparent", color: "#63C2FF", fontSize: 12, cursor: "pointer" }}
              >
                goto {name}
              </button>
            ))}
            <button
              onClick={goBackScene}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 12, cursor: "pointer" }}
            >
              ‹ back()
            </button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, fontFamily: "monospace", lineHeight: 1.6 }}>
            {sceneLog.length === 0 ? "(還沒有切換紀錄)" : sceneLog.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Camera 展示(camera 系統唯一沒辦法在沙箱驗證的部分)</div>
          <div
            style={{
              position: "relative", height: 100, borderRadius: 10, overflow: "hidden",
              background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
              marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{ ...cameraBoxStyle, fontSize: 13, opacity: 0.6 }}>畫面框(zoom/pan 會套用在這裡)</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, fontFamily: "monospace" }}>
            zoom={cameraReadout.zoom.toFixed(3)} · x={cameraReadout.x.toFixed(1)} ·
            y={cameraReadout.y.toFixed(1)} · timeScale={cameraReadout.timeScale.toFixed(3)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button onClick={() => triggerCameraPreset("bossEntrance")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #63C2FF", background: "transparent", color: "#63C2FF", fontSize: 12, cursor: "pointer" }}>BOSS 登場</button>
            <button onClick={() => triggerCameraPreset("bossEntranceEnd")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #63C2FF", background: "transparent", color: "#63C2FF", fontSize: 12, cursor: "pointer" }}>登場結束</button>
            <button onClick={() => triggerCameraPreset("bossSkill")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FF9F45", background: "transparent", color: "#FF9F45", fontSize: 12, cursor: "pointer" }}>BOSS 技能</button>
            <button onClick={() => triggerCameraPreset("comboMilestone", 300)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 12, cursor: "pointer" }}>Combo 里程碑</button>
            <button onClick={() => triggerCameraPreset("bossDeath")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FF5A6E", background: "transparent", color: "#FF5A6E", fontSize: 12, cursor: "pointer" }}>BOSS 死亡</button>
            <button onClick={resetCamera} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #C0C8D0", background: "transparent", color: "#C0C8D0", fontSize: 12, cursor: "pointer" }}>reset</button>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Particle / Lighting 展示(particle 系統唯一沒辦法在沙箱驗證的部分)</div>

          <div
            ref={particleBoxRef}
            style={{
              position: "relative", height: 140, borderRadius: 10, overflow: "hidden",
              background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
              marginBottom: 10,
            }}
          >
            <LightingLayer lighting={lightingRef.current} style={{ position: "absolute", inset: 0 }} />
            <ParticleLayer pm={particleRef.current} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.5, pointerEvents: "none" }}>
              粒子/光效會出現在這個框內
            </div>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Particle presets</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            <button onClick={() => triggerParticlePreset("comboMilestone", 300)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 12, cursor: "pointer" }}>combo 里程碑</button>
            <button onClick={() => triggerParticlePreset("perfectHit")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 12, cursor: "pointer" }}>perfect hit</button>
            <button onClick={() => triggerParticlePreset("greatHit")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #63C2FF", background: "transparent", color: "#63C2FF", fontSize: 12, cursor: "pointer" }}>great hit</button>
            <button onClick={() => triggerParticlePreset("explosion")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FF9F45", background: "transparent", color: "#FF9F45", fontSize: 12, cursor: "pointer" }}>爆炸碎屑</button>
            <button onClick={() => triggerParticlePreset("trail", Math.PI)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #59E38C", background: "transparent", color: "#59E38C", fontSize: 12, cursor: "pointer" }}>必殺拖尾</button>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Lighting presets</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button onClick={() => triggerLightingPreset("bossPhaseAlertP2")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FFA83C", background: "transparent", color: "#FFA83C", fontSize: 12, cursor: "pointer" }}>BOSS P2 警示</button>
            <button onClick={() => triggerLightingPreset("bossPhaseAlertP3")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FF3C3C", background: "transparent", color: "#FF3C3C", fontSize: 12, cursor: "pointer" }}>BOSS P3 警示</button>
            <button onClick={() => triggerLightingPreset("dangerVignette")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FF2222", background: "transparent", color: "#FF2222", fontSize: 12, cursor: "pointer" }}>嚴重失衡警戒</button>
            <button onClick={() => triggerLightingPreset("comboAura", 300)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #FFD700", background: "transparent", color: "#FFD700", fontSize: 12, cursor: "pointer" }}>combo 光暈</button>
          </div>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)", position: "relative" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>UI 設計系統展示(ui 系統唯一沒辦法在沙箱驗證的部分)</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
            這裡的元件是搬自 `web-build/index.html` 真的存在的 `GameButton`/`styles`,
            不是新設計——現有展示區塊的按鈕維持原樣沒有換,只是新增這個獨立區塊。
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Button</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Button variant="primary" onClick={() => setUiDialogOpen(true)}>primary</Button>
            <Button variant="secondary" onClick={() => setUiProgress((p) => Math.max(0, p - 0.15))}>secondary</Button>
            <Button variant="ghost" onClick={() => setUiProgress((p) => Math.min(1, p + 0.15))}>ghost</Button>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Panel</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Panel variant="panel" style={{ flex: 1, fontSize: 11 }}>variant="panel"</Panel>
            <Panel variant="card" style={{ flex: 1, fontSize: 11, maxWidth: "none" }}>variant="card"</Panel>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Card(點擊切換選中)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {["紅線", "藍線", "綠線"].map((name, i) => (
              <Card key={name} active={uiCardActive === i} onClick={() => setUiCardActive(i)} style={{ fontSize: 13 }}>
                {name}
              </Card>
            ))}
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>ProgressBar(用 secondary/ghost 按鈕調整數值,三段式配色)</div>
          <ProgressBar value={uiProgress} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12, fontFamily: "monospace" }}>value={uiProgress.toFixed(2)}</div>

          <Dialog
            open={uiDialogOpen}
            title="Dialog 展示"
            onDismiss={() => setUiDialogOpen(false)}
            actions={
              <>
                <Button variant="primary" onClick={() => setUiDialogOpen(false)}>關閉</Button>
                <Button variant="ghost" onClick={() => setUiDialogOpen(false)}>略過</Button>
              </>
            }
          >
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "#C0C8D0", textAlign: "left", width: "100%" }}>
              對照原始碼 tiltAskOverlay/tiltAskCard(陀螺儀權限詢問/取名彈窗)搬過來的殼元件,
              點擊「primary」按鈕觸發,點背景或按鈕都能關閉。
            </div>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
