// PlayScene —— Phase 3(Judge 接線)最小可玩判定畫面。
//
// 目的:把獨立、可測試但完全沒有畫面在用的 `judge/gameEngine.js` 真的接上
// 一個可以按鍵盤打的畫面,讓你能實際感受判定手感、耳朵聽到聲音、眼睛看到
// combo 特效與鏡頭震動,而不是只看 node 測試的斷言數字。
//
// ⚠️ 刻意的範圍邊界(不是完整移植 web-build/index.html 的遊戲畫面):
// - 只餵「一般音符」判定路徑(judgeCore 的第 6 段分支)。**2026-07-15l
//   接線**:可選傳入 `track`(`{name,file,chart}`,對照 `data/songs.js`
//   的 `REDLINE_TRACKS`/`DEFAULT_TRACKS` 形狀),掛載後會先照樣播
//   `judge/scoring.js` 的 `buildChart()` 備援固定節奏(不會卡在等 fetch),
//   如果 `track.chart` 有給值就同時嘗試 fetch 真正的譜面 JSON,拿到後
//   把備援節奏換成真正的譜面(跟 `BossScene.jsx` chart 驅動模式一樣的
//   「先用備援墊著,拿到真資料再換上」寫法)。**`web-build/assets/` 還沒
//   搬進這個專案,fetch 目前一定會失敗**,所以沒傳 `track` 或素材沒搬進來
//   之前,實際上永遠是備援節奏。
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
  laneLeftExpr, laneWidthExpr, JUDGE_LABEL, ITEM_DEFS, vibrate,
} from "../config/index.js";
import { buildChart } from "../judge/index.js";
import { createGameEngine } from "../judge/gameEngine.js";
import {
  createItemManager, expressBlastResult,
  createDefaultRogue, recalcRogue, rollArrivalCards,
} from "../judge/index.js";
import { FxLayer } from "../effect/index.js";
import { applyCameraPreset } from "../camera/index.js";
import {
  createParticleManager, emitParticlePreset,
  createLightingManager, applyLightingPreset,
  ParticleLayer, LightingLayer,
} from "../particle/index.js";
import { createNpcManager } from "../npc/index.js";
import { loadSave, writeSave } from "../save/index.js";
import { Button, Card, Dialog, ProgressBar } from "../ui/index.js";

const CHART_CYCLES = 6; // 16 步/cycle * BEAT_SEC(0.6s) ≈ 9.6 秒/cycle,約 1 分鐘的備援節奏
const NPC_ROLL_INTERVAL_MS = 3000; // 對照原始碼 npcRollTimerRef 的抽選間隔
const ITEM_KEY_MAP = { 1: "headphone", 2: "sunglasses", 3: "clearcard", 4: "express" };

function laneCenterPercent(lane) {
  return (lane + 0.5) * (100 / LANES.length);
}

// judgeCore 只認得 "perfect"/"great"/"good"/"miss" 這幾種 label,對應
// FxManager 的 FX_DURATIONS/FX_LABEL key 剛好同名(小寫),這裡只需要
// 把 registerHit 吐出的大寫 JUDGE_LABEL 文字轉回 fx type;不認得的文字
// (雙軌/炸彈/雜訊專用,這個場景不會出現)一律 fallback 成 "glow"。
const LABEL_TO_FX = { PERFECT: "perfect", GREAT: "great", GOOD: "good", MISS: "miss" };

export default function PlayScene({ audio, fx, shake, camera, onExit, track, stationIndex }) {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [stability, setStability] = useState(100);
  const [counts, setCounts] = useState({ perfect: 0, great: 0, good: 0, miss: 0 });
  const [imbalanceActive, setImbalanceActive] = useState(false);
  const [ended, setEnded] = useState(false);
  const [rogueCardIds, setRogueCardIds] = useState([]);
  const [rogueOffer, setRogueOffer] = useState(null); // 抽卡 demo:目前待選的 3 張卡,null=沒在選卡
  const [notice, setNotice] = useState("");
  // 每幀都會變的畫面資料收在這裡(不是 React state),渲染時直接讀
  // `viewRef.current.xxx`,只靠 `renderTick` 這一顆 state 觸發重繪。
  const viewRef = useRef({ notes: [], bombs: [], noise: [], npcs: [], cameraStyle: {}, shakeStyle: {}, items: null });
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
  const resultSavedRef = useRef(false); // 通勤模式(有傳 stationIndex)結束時只寫存檔一次
  const endedRef = useRef(false); // 對照 `ended` state,但給 tick() 內部讀(避免 stale closure),播完後徹底停掉 tick 迴圈用
  const comboRef = useRef(0); // 鏡像 `combo` state,給 engine callback(閉包只建立一次)讀即時值用,理由同其他「讀 ref 不讀 state」的修正
  const noticeTimerRef = useRef(null);

  const particleRef = useRef(null);
  if (!particleRef.current) particleRef.current = createParticleManager();
  const lightingRef = useRef(null);
  if (!lightingRef.current) lightingRef.current = createLightingManager();
  const npcRef = useRef(null);
  if (!npcRef.current) npcRef.current = createNpcManager();
  const itemsRef = useRef(null);
  if (!itemsRef.current) itemsRef.current = createItemManager();
  const rogueRef = useRef(createDefaultRogue()); // 目前已選卡片重新算出的 rogue 狀態,同步餵給 engine.setRogue()

  const showNotice = (text, durationMs = 1600) => {
    setNotice(text);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), durationMs);
  };

  // activateItem:對照原始碼 `useItem()` 的一般行駛階段分支(BOSS 分支的
  // headphone=護盾/sunglasses=彈幕減速/clearcard=清彈幕由 `BossScene.jsx`
  // 自己接,不是這裡)。1/2/3/4 鍵跟畫面按鈕共用同一個函式。
  const activateItem = (key, now) => {
    if (key === "express") {
      const result = itemsRef.current.fireExpress(now);
      if (!result) { showNotice("必殺技集氣還沒滿"); return; }
      // 對照 `expressBlast()`:炸掉盤面上所有音符/雜訊/炸彈,一般行駛
      // 階段每顆固定算 Perfect(100 分),回穩上限 12。
      const total = notesRef.current.length + npcRef.current.bombs.length + npcRef.current.noise.length;
      notesRef.current = [];
      npcRef.current.bombs = [];
      npcRef.current.noise = [];
      if (total > 0) {
        const { scoreDelta, stabilityDelta } = expressBlastResult(total);
        setScore((s) => s + scoreDelta);
        engineRef.current.addStability(stabilityDelta, undefined, now);
      }
      const { x, y } = laneToPx(2, 0.5);
      emitParticlePreset(particleRef.current, "explosion", x, y);
      showNotice(`⚡ 必殺技!清空 ${total} 顆音符`);
      return;
    }
    const result = itemsRef.current.useItem(key, now, { rogue: rogueRef.current });
    if (!result) { showNotice("充能不足"); return; }
    if (key === "sunglasses") {
      engineRef.current.setItems({ sunglasses: { activeUntil: result.activeUntil } });
      showNotice("🕶 墨鏡啟動 · Perfect 判定窗變寬(若持有墨鏡達人卡)");
    } else if (key === "clearcard") {
      // 對照原始碼 running 分支:`setNpcs([])` 清空 NPC 實體(不動已經丟出
      // 的雜訊/炸彈,對照 Phase 9 npc/README.md 記錄過的同一個職責邊界)。
      npcRef.current.active = [];
      showNotice("🎫 清屏 · NPC 清空");
    } else if (key === "headphone") {
      // 對照研究結論:原始碼 running 分支的 headphone 目前只有設定
      // activeUntil,沒有找到其他明確的機制效果(BOSS 分支才是護盾),
      // 這裡忠實保留這個「看起來沒做什麼」的行為,不額外發明效果。
      showNotice("🎧 降噪耳機啟動");
    }
  };

  // ── 肉鴿卡(demo)── 這個場景沒有真正的「進站」多站流程,用一個按鈕
  // 模擬原始碼的「arrival 三選一」:排除已選過的卡,抽 3 張供選,選一張
  // 就 recalcRogue() 重算全部效果餵給 engine,monthlypass 額外觸發
  // `refillAll()`(它的效果是選卡當下的一次性 side effect,不是
  // recalcRogue 算出來的常駐欄位,見 `judge/rogue.js` 開頭註解)。
  const rollRogue = () => {
    const offer = rollArrivalCards(rogueCardIds, 3, Math.random);
    if (offer.length === 0) { showNotice("卡池已經抽完了"); return; }
    setRogueOffer(offer);
  };
  const pickRogue = (card) => {
    const nextIds = [...rogueCardIds, card.id];
    setRogueCardIds(nextIds);
    setRogueOffer(null);
    rogueRef.current = recalcRogue(nextIds);
    engineRef.current.setRogue(rogueRef.current);
    if (card.id === "monthlypass") itemsRef.current.refillAll();
    showNotice(`🎴 選了「${card.name}」`);
  };

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
      onComboChange: (next) => { setCombo(next); setMaxCombo((mc) => Math.max(mc, next)); comboRef.current = next; },
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
        // 道具/肉鴿卡接線:必殺技集氣,對照原始碼 `addExpressCharge()` 在
        // 每次 Perfect/Great/Good 判定時呼叫(miss 不會呼叫到,`onPlayDrum`
        // 本身就是 registerHit 一開始就會跑的 callback,涵蓋所有判定類別,
        // `ItemManager.addExpressCharge()` 內部對 miss 直接無視,兩層防呆
        // 都有,不影響行為)。讀 `comboRef.current`(不是 `combo` state,
        // 避免 stale closure)當「這次命中前的 combo」。
        itemsRef.current.addExpressCharge(category, comboRef.current, rogueRef.current.expressMult);
      },
      onPlayComboFanfare: () => audio.playComboFanfare(),
      onVibrate: (pattern) => vibrate(pattern),
      onComboMilestoneFx: (tier) => {
        // ⚠️ 2026-07-15o 修正:`shake.trigger()` 的 `now` 參數同樣要明確
        // 傳 `performance.now()`,理由跟下面 camera 那行完全一樣——沒傳的
        // 話預設 `Date.now()`,跟 tick 迴圈呼叫 `shake.getOffset(now)` 用
        // 的 `performance.now()` 時鐘基準對不上,`isActive()` 會永遠判定
        // 為 true(小數字 performance.now() 幾乎必定小於 Date.now() 那個
        // 巨大時間戳 + 300ms),導致震動「一觸發就再也不會停」,`decay`
        // 公式因為時間差是天文數字大的負值而算出天文數字大的位移量,畫面
        // 被推到螢幕外(看起來像全黑看不到音符),而且因為 `isActive`
        // 永遠是 true,這個位移量每幀都用 `now` 重新算一次偽隨機值,
        // 才會有「一直抖動」的感覺——這才是「combo 50 一觸發畫面就黑掉、
        // 一直抖」的真正根因,比之前修的炸彈碰撞時機問題更嚴重、影響更
        // 持久(一旦觸發就不會恢復,不像穩定度掉到 0 至少 2 秒後会恢復)。
        shake.trigger(6 + tier / 15, 260, performance.now());
        // ⚠️ 2026-07-15o 修正:一定要明確傳入 `performance.now()`——
        // `CAMERA_PRESETS.comboMilestone` 的 `now` 參數預設是
        // `Date.now()`(Unix epoch 毫秒,一個 10+ 位數的巨大數字),但這個
        // 場景的 tick 迴圈全程都是用 `performance.now()`(從頁面載入起算
        // 的毫秒數,數字小很多)呼叫 `camera.getState(now)` 讀值——兩個
        // 時鐘基準不一樣,punchZoom 存的 `startAt` 是用 `Date.now()`,
        // 之後 `getZoom(performance.now())` 算「經過多久」時兩者相減會
        // 是一個天文數字大的負值,衰減公式算出來的 zoom 也會是天文數字,
        // 畫面整個被縮放到只剩一片單色(玩家看到的「combo 50 一觸發畫面
        // 就黑掉、音符消失」),不是真的黑幕特效,是這個時鐘沒對齊的 bug。
        applyCameraPreset(camera, "comboMilestone", tier, performance.now());
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

  // 2026-07-15l 接線:有給 `track.chart` 就嘗試載入真正的譜面,拿到後
  // 換掉正在播的備援節奏(對照 `BossScene.jsx` 的 chart 驅動模式同一套
  // 「先備援墊著,拿到真資料再換」寫法)。沒給 `track` 或 fetch 失敗
  // (目前一定會失敗,見檔案開頭註解)就什麼都不做,繼續用備援節奏。
  useEffect(() => {
    if (!track?.chart) return;
    let cancelled = false;
    fetch(track.chart)
      .then((r) => { if (!r.ok) throw new Error("no chart"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const notes = Array.isArray(data?.notes)
          ? data.notes.map((n, i) => ({ id: `chart-${i}`, lane: n.lane, hitTime: n.time }))
          : [];
        if (notes.length === 0) return;
        chartRef.current = notes;
        nextIdxRef.current = 0;
      })
      .catch(() => { /* 拿不到就維持備援節奏,不用特別處理 */ });
    return () => { cancelled = true; };
  }, [track]);

  useEffect(() => {
    audio.ensure(0.8);
    chartRef.current = buildChart(CHART_CYCLES);
    nextIdxRef.current = 0;
    notesRef.current = [];
    startPerfRef.current = performance.now();

    const tick = () => {
      // 播完就徹底停掉這個迴圈,不再重新排下一幀——修正一個曾經發生的
      // bug:原本播完只有 `setEnded(true)` 顯示文字,tick 迴圈本身沒有
      // 停,NPC 抽選/雙軌行李箱音符還是會繼續生成,新音符一直被判 miss
      // 導致穩定度一直掉、嚴重失衡的暗角警示反覆觸發(看起來像「黑畫面
      // 一直閃」),而且因為 NPC 雙軌音符會塞進 `notesRef`,導致下面
      // 「有沒有播完」的判斷條件也連帶一直不成立、存檔永遠寫不進去。
      if (endedRef.current) return;

      const now = performance.now();
      beatClockRef.current = (now - startPerfRef.current) / 1000;
      const t = beatClockRef.current;

      // 從備援譜面掃出「進入下落範圍」的新音符(對應 index.html 2218 行附近)。
      const chart = chartRef.current;
      while (nextIdxRef.current < chart.length && chart[nextIdxRef.current].hitTime - APPROACH_SEC <= t) {
        const c = chart[nextIdxRef.current];
        notesRef.current = [...notesRef.current, { id: c.id, lane: c.lane, hitTime: c.hitTime }];
        nextIdxRef.current += 1;
        // doublebeat 卡的 noteRateMult:機率插一顆額外音符在別的軌道,對照
        // 原始碼「(noteRateMult||1)>1 時,依 (noteRateMult-1) 機率多生一顆」
        // 的機率密度提升寫法(不是固定間隔變快,是機率性補一顆)。
        const noteRateMult = rogueRef.current.noteRateMult || 1;
        if (noteRateMult > 1 && Math.random() < noteRateMult - 1) {
          const extraLane = (c.lane + 1 + Math.floor(Math.random() * (LANES.length - 1))) % LANES.length;
          notesRef.current = [...notesRef.current, { id: `${c.id}-extra`, lane: extraLane, hitTime: c.hitTime }];
        }
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
        // rushpay 卡的 npcExtra 直接加進並存上限(對照原始碼 `idxState.npcCap
        // + (stability<30?1:0) + npcExtra`,`npcManager.rollSpawn()` 本身
        // 已經處理 stability<30 那一段,這裡只需要把 npcExtra 加進 npcCap)。
        const npcCap = 2 + (rogueRef.current.npcExtra || 0);
        const type = npc.rollSpawn(now, { npcWeight: 1, npcCap, stability: liveStability }, Math.random);
        if (type) npc.spawn(type, now, { rand: Math.random });
      }
      // ⚠️ 2026-07-15n 修正:這裡原本錯誤地拿「現在 t」去比對盤面音符,但
      // NPC 這次雜訊/炸彈真正會落下命中的時間是 `t + APPROACH_SEC`(還要
      // 再過 1.3 秒才會到判定線),不是現在——原本的寫法等於完全沒在檢查
      // 「新雜訊/炸彈會不會跟真音符疊在同一軌道同一時間點」,導致炸彈常常
      // 跟真音符疊在同一軌道/同一時間,玩家按下去會被判定成「打中炸彈」
      // (combo 歸零 + 穩定度 -8)而不是打中音符,一直發生就會一直掉穩定度、
      // 反覆觸發嚴重失衡的暗角警示(視覺上像畫面一直閃/變暗),這是使用者
      // 實測回報「一直掉穩定度、畫面抖動全黑」的真正根因(比先前修的「播完
      // 沒真的停下來」那個 bug 更關鍵,那個只影響播完之後,這個是遊玩全程
      // 都會發生)。改成比對「未來真正會落下的時間點」才對。
      const landTime = t + APPROACH_SEC;
      const isLaneFree = (lane) =>
        !notesRef.current.some((n) => Math.abs(n.hitTime - landTime) < 0.35 && (n.lane === lane || n.doubleLane === lane));
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

      // 道具/肉鴿卡接線:站務員巡查通過補道具(對照原始碼「🎉 巡查通過」,
      // 補幾次由 loyalty/announce 卡的 `refillCount` 決定,對照原始碼
      // `for (let i=0;i<rogueRef.current.refillCount;i++) refillRandomItem()`)。
      // 這個 hook 之前 Phase 9 NPC 接線時就有 `staffResult` 可用,只是當時
      // 道具系統還沒接,一直沒真的消費過,這次補上。
      if (npcResult.staffResult?.success) {
        for (let i = 0; i < (rogueRef.current.refillCount || 1); i++) {
          const refilled = itemsRef.current.refillRandomItem(Math.random);
          if (refilled) showNotice(`🎉 巡查通過 · ${ITEM_DEFS[refilled].label} +1`);
        }
      }
      // regenphone/priorityseat 卡的計時器效果。
      const regenResult = itemsRef.current.tickRegenPhone(now, rogueRef.current.regenPhone);
      if (regenResult) showNotice(`♻️ 再生耳機 · 降噪耳機 +1(現在 ${regenResult.charges})`);
      const seatResult = itemsRef.current.tickPrioritySeat(now, rogueRef.current.prioritySeat);
      if (seatResult) engineRef.current.addStability(seatResult.stabilityDelta, undefined, now);

      // 增益 NPC 效果:直接對照 active 清單推導出的「有效到」時間戳,餵給
      // gameEngine 既有的 setBuffXxxUntil() API(這兩個 setter 是 Phase 3
      // 就設計好、專門留給 NPC 系統接線用的,見 `judge/gameEngine.js` 開頭
      // 「刻意不在這裡做的事」段落)。
      const policeNpc = npc.active.find((n) => n.type === "police");
      engineRef.current.setBuffGoodToPerfectUntil(policeNpc ? policeNpc.bornAt + policeNpc.durationMs : 0);
      const conductorNpc = npc.active.find((n) => n.type === "conductor");
      engineRef.current.setBuffMissImmuneUntil(conductorNpc ? conductorNpc.bornAt + conductorNpc.durationMs : 0);
      // 墨鏡(sunglasses)的 perfWindowMult 加成要靠 `items.sunglasses.
      // activeUntil` 這個 gate(對照 shades 卡的機制,見 `judge/gameEngine.js`
      // judgeCore 233 行附近的 pwin 算式),每幀同步一次,不用擔心漏同步。
      engineRef.current.setItems({ sunglasses: { activeUntil: itemsRef.current.activeUntil.sunglasses } });

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
      view.items = {
        charges: { ...itemsRef.current.charges },
        activeUntil: { ...itemsRef.current.activeUntil },
        expressCharge: itemsRef.current.expressCharge,
        expressReady: itemsRef.current.expressReady,
        now,
      };
      bumpRender();

      // 「播完了沒」只看備援譜面本身的音符還有沒有沒打到的(`kind !==
      // "double"` 排除掉 NPC 占位行李客塞進 `notesRef` 的雙軌音符)——
      // NPC 系統是獨立於「這首歌播完沒」之外的東西,不該讓它們一直生新
      // 音符就導致「播完」這個條件永遠不成立。
      const realNotesRemaining = notesRef.current.some((n) => n.kind !== "double");
      if (nextIdxRef.current >= chart.length && !realNotesRemaining) {
        endedRef.current = true;
        setEnded(true);
        // 2026-07-15l 接線:通勤模式(有傳 stationIndex)結束時真的寫存檔
        // ——過關 + 更新最佳分數,對照原始碼「單站跑完更新 stationCleared/
        // stationBest」的行為(但這裡沒有做完整的結算/評級畫面,只做
        // 存檔這一步)。讀 engine 內部即時 score(同一份物件參照,不是
        // 閉包裡的 `score` React state,理由同 BossScene.jsx 的 liveScore
        // 修正)。
        //
        // ⚠️ 2026-07-15p 修正:原本只改了 `save.routes.ruby`,但
        // `loadSave()` 既有的合併邏輯(Phase 1 逐字搬過來的,#3 存檔格
        // 機制)只要 `save.slots` 陣列存在(第一次 `writeSave()` 之後就會
        // 存在,因為 `defaultSave()` 本來就帶了 3 個空存檔格),`routes.
        // ruby` 就一律被視為「使用中存檔格」(`slots[activeSlot].ruby`)
        // 的唯讀鏡像,下次 `loadSave()` 會直接拿 `slots[activeSlot].ruby`
        // 蓋掉 `routes.ruby`——只改 `routes.ruby` 這個鏡像欄位,下次讀檔
        // 就會被真正的存檔格資料蓋回去,等於白寫。真正該寫的是
        // `save.slots[save.activeSlot].ruby`,這裡兩個都更新(鏡像欄位
        // 也同步更新,避免同一次 render 裡有地方直接讀 `routes.ruby` 拿到
        // 舊值)。
        if (stationIndex != null && !resultSavedRef.current) {
          resultSavedRef.current = true;
          const liveScore = engineRef.current.getState().score;
          const save = loadSave();
          const slotRuby = save.slots[save.activeSlot].ruby;
          slotRuby.stationCleared[stationIndex] = true;
          slotRuby.stationBest[stationIndex] = Math.max(slotRuby.stationBest[stationIndex] || 0, liveScore);
          save.routes.ruby = JSON.parse(JSON.stringify(slotRuby)); // 同步鏡像欄位
          save.stats.plays = (save.stats.plays || 0) + 1;
          writeSave(save);
        }
        return; // 不再排下一幀,徹底停掉 tick 迴圈
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onKeyDown = (e) => {
      const itemKey = ITEM_KEY_MAP[e.key];
      if (itemKey) { activateItem(itemKey, performance.now()); return; }
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
          <div style={{ fontSize: 18, fontWeight: 700 }}>共GO · 判定測試場(最小可玩){track ? ` · ${track.name}` : ""}</div>
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

        {notice && (
          <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,215,0,0.1)", fontSize: 12, textAlign: "center" }}>
            {notice}
          </div>
        )}

        {viewRef.current.items && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["headphone", "sunglasses", "clearcard"].map((key, i) => {
              const def = ITEM_DEFS[key];
              const charges = viewRef.current.items.charges[key];
              const active = viewRef.current.items.now < viewRef.current.items.activeUntil[key];
              return (
                <Button
                  key={key}
                  variant={active ? "primary" : "secondary"}
                  style={{ flex: 1, fontSize: 11, opacity: charges > 0 ? 1 : 0.4, borderColor: def.color, color: active ? undefined : def.color }}
                  onClick={() => activateItem(key, performance.now())}
                >
                  {i + 1}·{def.label}({charges})
                </Button>
              );
            })}
            <Button
              variant={viewRef.current.items.expressReady ? "primary" : "ghost"}
              style={{ flex: 1, fontSize: 11 }}
              onClick={() => activateItem("express", performance.now())}
            >
              4·{viewRef.current.items.expressReady ? "必殺!" : `${Math.floor(viewRef.current.items.expressCharge)}%`}
            </Button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            肉鴿卡:{rogueCardIds.length === 0 ? "(尚未選過)" : rogueCardIds.map((id) => id).join(", ")}
          </div>
          <Button variant="ghost" style={{ fontSize: 11 }} onClick={rollRogue}>🎴 抽卡(demo)</Button>
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
            {stationIndex != null
              ? "這站跑完了,過關 + 最佳分數已經寫回存檔(這只是最小可玩測試,沒有完整結算畫面)。"
              : "備援節奏播完了(這只是最小可玩測試,沒有結算畫面)。"}
          </div>
        )}
      </div>

      <Dialog open={!!rogueOffer} title="🎴 抽到 3 張肉鴿卡(demo)">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {(rogueOffer || []).map((card) => (
            <Card key={card.id} onClick={() => pickRogue(card)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{card.icon} {card.name}{card.type === "deal" ? " (惡魔交易)" : ""}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{card.desc}</div>
            </Card>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
