// BossScene —— Phase 9 接線:把獨立、只有 node 測試驗證過的
// `boss/bossManager.js`(BOSS 三階段/彈幕/特招/finisher/平衡對抗閘門/死亡
// 復活)真的接上一個可以按鍵盤打的畫面,同時接上 Phase 6 Camera、Phase 7
// Particle/Lighting、Phase 8 UI 元件——這是這幾個系統第一次真的一起跑在
// 同一個畫面上。
//
// 跟 `PlayScene.jsx`(一般判定測試場)刻意分開兩個檔案,不是合併成一個
// 「萬用場景」:原始碼裡 BOSS 戰本來就是完全獨立的 phase(`judgeCore` 也
// 是靠 `phase==="boss"` 分支明確區分,兩條分支互不重疊),NPC 事件只在
// 一般行駛階段出現(BOSS 戰沒有一般 NPC),兩個場景各自對應原始碼的兩種
// 不同遊戲階段,分開寫比塞成一個超大 if/else 更貼近原始架構。
//
// ⚠️ 刻意的範圍邊界(不是完整移植 BOSS 戰畫面):
// - **彈幕現在有兩種模式**(2026-07-15k 補上 chart 驅動模式):掛載時會
//   先 `fetch("assets/boss-bgm-<bossId>.normal.json")`,拿得到就照譜面
//   時間點生彈幕(P2/P3 依 `rollExtraChartNote()` 機率多插一顆),拿不到
//   (目前一定會是這樣,見下一條)就退回原本的備援固定間隔模式
//   (`spawnWave`)——這個 fallback 行為本身就是對照原始碼寫的(原始碼
//   也是「有 chart 用 chart,沒有就退回固定間隔」),不是這次新發明的。
// - **2026-07-15q 更新:素材已搬入**,`assets/boss-bgm-<bossId>.normal.json`
//   現在真的抓得到資料,不再永遠 fallback 到備援固定間隔模式,詳見
//   `systems/assets/README.md`。
// - 沒有 BOSS 立繪/彈幕美術素材疊圖——素材檔案本體雖然已經搬進
//   `public/assets/`,但這個場景還沒有改成 `<img src={ART.xxx}>` 真的
//   套用,彈幕/BOSS 本體目前還是畫成純色塊。
// - 平衡對抗閘門的「抵抗方向」只接鍵盤方向鍵(←/→),沒有接手機陀螺儀
//   (那是 `systems/config/constants.js` IS_TOUCH 判斷之後才會處理的範圍)。
//
// ⚠️ 完全沒有經過瀏覽器實測。
import { useEffect, useRef, useState } from "react";
import {
  LANES, KEY_TO_LANE, WINDOW_GOOD, APPROACH_SEC, FALL_DISTANCE, ITEM_DEFS, EXPRESS_NEED,
  laneLeftExpr, laneWidthExpr, OPP_DIR, vibrate,
} from "../config/index.js";
import { createGameEngine } from "../judge/gameEngine.js";
import { createItemManager } from "../judge/items.js";
import { FxLayer } from "../effect/index.js";
import { applyCameraPreset } from "../camera/index.js";
import {
  createParticleManager, emitParticlePreset,
  createLightingManager, applyLightingPreset,
  ParticleLayer, LightingLayer,
} from "../particle/index.js";
import { createBossManager } from "../boss/index.js";
import { createDefaultRogue, recalcRogue, rollArrivalCards } from "../judge/index.js";
import { loadSave, writeSave } from "../save/index.js";
import { Button, Card, ProgressBar, Dialog } from "../ui/index.js";

const REVIVE_COST = 80; // 對照原始碼 confirmRevive() 的哩程扣點數
const ITEM_KEY_MAP = { 1: "headphone", 2: "sunglasses", 3: "clearcard", 4: "express" };

function laneCenterPercent(lane) {
  return (lane + 0.5) * (100 / LANES.length);
}
const LABEL_TO_FX = { PERFECT: "perfect", GREAT: "great", GOOD: "good", MISS: "miss" };

// onFinished(2026-07-15 選單流程接線新增):可選 callback。討伐成功時呼叫
// 一次(`{ ...engine.getState(), outcome:"win", bossId }`);玩家死亡後在
// 復活詢問卡片選「我要下車」放棄挑戰時也會呼叫(`outcome:"lose"`)——兩種
// 情況都給外層(App.jsx 選單流程)導向 BossResultScene 用。純新增,沒傳這個
// prop 時行為完全不變(仍是原本場景內建的「討伐成功」Dialog / onExit)。
// initialRogueCardIds(2026-07-15 選單流程接線新增):通勤模式全程累積的
// 肉鴿卡(對照原始碼整趟通勤結束後帶進終點 BOSS 戰的 `runCardsRef`),
// App.jsx 進 BOSS 戰時傳進來,這個場景只有 `finalsprint` 卡的
// `bossDmgMult` 真的有作用(其餘欄位在 BOSS 戰沒有對應的呼叫端,見
// `judge/README.md` 2026-07-15r 章節),沒傳(BOSS 戰測試/舊呼叫端)就
// 維持原本從預設值開始的行為。
export default function BossScene({ audio, fx, shake, camera, onExit, bossId = "redline", onFinished, initialRogueCardIds }) {
  const [bossHp, setBossHp] = useState(100);
  const [playerHp, setPlayerHp] = useState(100);
  const [phase, setPhase] = useState(1);
  const [score, setScore] = useState(0);
  const [notice, setNotice] = useState("");
  const [outcome, setOutcome] = useState(null); // null | "win" | "lose"
  const [reviveAsk, setReviveAsk] = useState(false);
  const [rogueCardIds, setRogueCardIds] = useState(initialRogueCardIds || []);
  const [rogueOffer, setRogueOffer] = useState(null);
  const rogueRef = useRef(recalcRogue(initialRogueCardIds || [])); // 目前只有 finalsprint 卡的 bossDmgMult 在這個場景有作用
  // 每幀都會變的畫面資料(彈幕位置/QTE 進度/鏡頭震動)收在這裡,不是 React
  // state,渲染時直接讀 `viewRef.current.xxx`,只靠 `renderTick` 這一顆
  // state 觸發重繪——跟 `PlayScene.jsx`/`ParticleLayer.jsx` 同樣的模式,
  // 見 `systems/game/README.md`「主遊戲迴圈重構」章節。
  const viewRef = useRef({ bullets: [], holdUi: null, gateUi: null, cameraStyle: {}, shakeStyle: {} });
  const [, setRenderTick] = useState(0);
  const bumpRender = () => setRenderTick((t) => (t + 1) % 1000000);

  const bulletsRef = useRef([]);
  const startPerfRef = useRef(null);
  const beatClockRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const rafRef = useRef(null);
  const engineRef = useRef(null);
  const fieldBoxRef = useRef(null);
  const bossComboRef = useRef(0);
  const heldLanesRef = useRef(new Set());
  const heldDirRef = useRef(null);
  // chart 驅動彈幕模式(2026-07-15k):`chartRef` 是排序過的 { lane, hitTime }
  // 陣列,`chartIdxRef` 是下一個還沒生的音符索引,對照 `PlayScene.jsx` 消耗
  // `buildChart()` 備援節奏的同一種寫法。`chartLoadedRef` 是三態
  // (null=還在載入中/true=拿到真的 chart/false=拿不到,退回備援模式)。
  const chartRef = useRef(null);
  const chartIdxRef = useRef(0);
  const chartLoadedRef = useRef(null);
  const lastBulletAtRef = useRef(0);
  const lastSpecialAtRef = useRef(0);
  const noticeTimerRef = useRef(null);
  const reviveOfferedRef = useRef(false);
  const winHandledRef = useRef(false);

  const bossRef = useRef(null);
  if (!bossRef.current) bossRef.current = createBossManager(100);
  // 2026-07-15s 補上:道具在 BOSS 戰有自己的語意(跟一般行駛階段不同),
  // 之前只顧著接肉鴿卡,忘記把 `judge/items.js` 接進這個場景——headphone
  // 變傷害護盾、sunglasses 變彈幕減速、clearcard 變瞬間清彈幕,對照原始碼
  // `useItem()` 的 boss 分支(1900-1960 行附近)。
  const itemsRef = useRef(null);
  if (!itemsRef.current) itemsRef.current = createItemManager();
  const particleRef = useRef(null);
  if (!particleRef.current) particleRef.current = createParticleManager();
  const lightingRef = useRef(null);
  if (!lightingRef.current) lightingRef.current = createLightingManager();

  const laneToPx = (lane, yRatio = 0.86) => {
    const rect = fieldBoxRef.current?.getBoundingClientRect();
    const w = rect ? rect.width : 320;
    const h = rect ? rect.height : FALL_DISTANCE + 40;
    return { x: (laneCenterPercent(lane) / 100) * w, y: yRatio * h };
  };

  const showNotice = (text, durationMs = 1400) => {
    setNotice(text);
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(""), durationMs);
  };

  // 同一組「命中/自傷 → BOSS 狀態 → 畫面回饋」邏輯,實際命中(judgeCore 的
  // `onBossHit`)、彈幕過期未打到(miss)兩條路徑都會呼叫這個 helper,
  // 對照原始碼「不管哪條路徑,bossApplyHit 都要跑一次」的行為。
  const applyBossHit = (cat, lane) => {
    const now = performance.now();
    const nextCombo = cat === "miss" ? 0 : bossComboRef.current + 1;
    bossComboRef.current = nextCombo;
    engineRef.current.setBossCombo(nextCombo);
    const b = bossRef.current;
    // finalsprint 卡(終點衝刺):BOSS 傷害 +30%,對照 `judge/rogue.js` 的
    // `bossDmgMult` 欄位,直接餵給 `BossManager.applyHit()` 本來就有的
    // `rogueDmgMult` 參數(Phase 9 建 boss 系統時就預留好的接口)。
    // headphone 道具在 BOSS 戰的效果是「傷害護盾」:生效時 miss 不會自傷
    // (對照原始碼 `shielded = invincible || (cat==="miss" &&
    // bossShieldUntilRef.current > now)`),餵給 `applyHit()` 本來就有的
    // `selfDmgActive` 參數(false = 自傷歸零)。
    const result = b.applyHit(cat, {
      combo: nextCombo,
      rogueDmgMult: rogueRef.current.bossDmgMult,
      selfDmgActive: !itemsRef.current.isActive("headphone", now),
    });
    if (result.finisherTriggered) {
      b.startHoldAttack(now, true, {});
      showNotice("⚠ BOSS 搖搖欲墜!最後一擊機會來了", 1200);
    }
    const gateKey = b.checkPhaseGate();
    if (gateKey) {
      bulletsRef.current = []; // 觸發平衡對抗閘門時清空盤面彈幕
      b.startGate(now, gateKey, {});
      showNotice(gateKey === "g50" ? "⚠ BOSS 暴走!彈幕加速加量" : "⚠ BOSS 狂暴!左右掃射", 1500);
      // Phase 7 接線:階段警示光效只在真的切換那一刻觸發一次(不是每幀
      // 都觸發)——`LightingManager.trigger()` 雖然本身就有「較弱不打斷
      // 較強」的保護,但沒必要每幀呼叫,只在切換瞬間觸發一次最乾淨。
      applyLightingPreset(lightingRef.current, gateKey === "g50" ? "bossPhaseAlertP2" : "bossPhaseAlertP3");
    }
    b.checkDeath();
    // 必殺技集氣:BOSS 戰的判定也會累積集氣(對照原始碼 `addExpressCharge`
    // 沒有分 running/boss,兩種畫面都會呼叫),miss 不會呼叫到(cat==="miss"
    // 時 `ItemManager.addExpressCharge` 內部本來就無視,這裡多一層 if 純粹
    // 避免傳無意義的呼叫)。
    if (cat !== "miss") itemsRef.current.addExpressCharge(cat, nextCombo, rogueRef.current.expressMult);
    if (lane != null) fx.spawn(cat === "miss" ? "miss" : cat, { x: laneCenterPercent(lane), y: 60 });
    if (cat !== "miss" && lane != null) {
      const { x, y } = laneToPx(lane);
      emitParticlePreset(particleRef.current, cat === "perfect" ? "perfectHit" : "greatHit", x, y);
    }
    setBossHp(b.hp); setPlayerHp(b.playerHp); setPhase(b.phase);
  };

  // activateItem:對照原始碼 `useItem()` 的 BOSS 分支——headphone/
  // sunglasses 只是設定充能/啟用時間戳(實際效果在 `applyBossHit`/彈幕
  // 生成那幾處讀取,見上面兩處註解),clearcard 是「瞬間清空盤面彈幕」
  // (對照原始碼 boss 分支 `setNotes([])`,不是清 NPC——BOSS 戰沒有一般
  // NPC),express 兩個階段都能用,對照原始碼「每顆爆炸的彈幕呼叫一次
  // `bossApplyHit('perfect')`,如果因此把 BOSS 打死會標記『必殺終結』」。
  const activateItem = (key, now) => {
    if (key === "express") {
      const result = itemsRef.current.fireExpress(now);
      if (!result) { showNotice("必殺技集氣還沒滿"); return; }
      const bullets = bulletsRef.current;
      bulletsRef.current = [];
      for (const bl of bullets) applyBossHit("perfect", bl.lane);
      const { x, y } = laneToPx(2, 0.5);
      emitParticlePreset(particleRef.current, "explosion", x, y);
      showNotice(`⚡ 必殺技!清空 ${bullets.length} 顆彈幕`);
      return;
    }
    const result = itemsRef.current.useItem(key, now, { rogue: rogueRef.current });
    if (!result) { showNotice("充能不足"); return; }
    if (key === "headphone") showNotice("🎧 降噪護盾啟動 · miss 不再自傷");
    else if (key === "sunglasses") showNotice("🕶 專注 · 彈幕減速");
    else if (key === "clearcard") {
      bulletsRef.current = [];
      showNotice("🎫 清屏 · 彈幕清空");
    }
  };

  if (!engineRef.current) {
    engineRef.current = createGameEngine({
      onScoreDelta: (delta) => setScore((s) => s + delta),
      onNoteConsumed: (id) => { bulletsRef.current = bulletsRef.current.filter((n) => n.id !== id); },
      onLaneFlash: (lane, category) => fx.spawn(category === "none" ? "glow" : category, { x: laneCenterPercent(lane), y: 86 }, { durationMs: 150 }),
      onLaneBurst: (lane) => fx.spawn("spark", { x: laneCenterPercent(lane), y: 86 }),
      onFloater: (lane, text) => fx.spawn(LABEL_TO_FX[text] || "glow", { x: laneCenterPercent(lane), y: 60 }),
      onPlayDrum: (lane, category) => audio.playDrum(LANES[lane] ? LANES[lane].key : "kick", category),
      onVibrate: (pattern) => vibrate(pattern),
      onBossHit: (cat) => applyBossHit(cat, undefined),
    });
  }

  // chart 驅動彈幕模式(2026-07-15k):對照原始碼 `startBoss()` 掛載時抓
  // 專屬歌曲譜面,拿得到就用 chart 驅動,拿不到就維持備援固定間隔模式
  // (見檔案開頭註解——`web-build/assets/` 還沒搬進這個專案,目前一定會
  // 走 fallback,這段程式碼是「準備好了」不是「現在能實測」)。
  useEffect(() => {
    let cancelled = false;
    chartLoadedRef.current = null;
    fetch(`assets/boss-bgm-${bossId}.normal.json`)
      .then((r) => { if (!r.ok) throw new Error("no chart"); return r.json(); })
      .then((data) => {
        if (cancelled) return;
        const notes = Array.isArray(data?.notes)
          ? [...data.notes].sort((a, b) => a.hitTime - b.hitTime)
          : [];
        chartRef.current = notes;
        chartIdxRef.current = 0;
        chartLoadedRef.current = notes.length > 0;
      })
      .catch(() => {
        if (cancelled) return;
        chartRef.current = null;
        chartLoadedRef.current = false;
      });
    return () => { cancelled = true; };
  }, [bossId]);

  useEffect(() => {
    audio.ensure(0.8);
    startPerfRef.current = performance.now();
    lastFrameAtRef.current = startPerfRef.current;
    bulletsRef.current = [];

    const tick = () => {
      const now = performance.now();
      const deltaMs = now - lastFrameAtRef.current;
      lastFrameAtRef.current = now;
      beatClockRef.current = (now - startPerfRef.current) / 1000;
      const t = beatClockRef.current;
      const b = bossRef.current;

      // sunglasses 道具在 BOSS 戰的效果是「彈幕減速」(對照原始碼
      // `bossSlowUntilRef`,APPROACH_SEC*1.7)。
      // ⚠️ 2026-07-15t 修正:之前雖然算出了拉長的 `hitTime`,但畫面渲染
      // (下面 JSX 的 `progress` 計算)一直是拿固定的 `APPROACH_SEC` 當
      // 分母,沒有讀彈幕自己的 `fallSec`——結果彈幕會在畫面最上方卡住不動
      // 一小段時間、然後用「正常速度」掉完最後一段,肉眼看起來完全沒有
      // 變慢(這是使用者實測抓到的 bug)。改成每顆彈幕都帶自己的
      // `fallSec`,渲染時用 `n.fallSec` 當分母,才會是真正貫穿全程的
      // 均勻減速。chart 驅動模式原本也沒套用 sunglasses(怕跟歌曲節奏
      // 對不上),但只調整「音符提早進入下落範圍的時間點」不會動到
      // `hitTime`(判定目標時間不變,跟歌曲節奏依然同步),所以這次一併
      // 套用,不用再等之後才修。
      const slowActive = itemsRef.current.isActive("sunglasses", now);
      const slowAppr = slowActive ? APPROACH_SEC * 1.7 : APPROACH_SEC;

      if (!b.outcome && !b.hold && !b.gate) {
        if (chartLoadedRef.current) {
          // ── chart 驅動模式(對照原始碼 bossChartRef 分支,2139 行)──
          // 依照譜面音符的實際時間點生彈幕,不是固定間隔;反堆疊規則
          // (同軌 0.35s 內已有音符就跳過,對照原始碼 2136 行)+ P2/P3
          // 依 `rollExtraChartNote()` 機率多插一顆(挑一個不同的軌道)。
          const chart = chartRef.current;
          while (chartIdxRef.current < chart.length && chart[chartIdxRef.current].hitTime - slowAppr <= t) {
            const c = chart[chartIdxRef.current];
            chartIdxRef.current += 1;
            const busy = bulletsRef.current.some((n) => n.lane === c.lane && Math.abs(n.hitTime - c.hitTime) < 0.35);
            if (busy) continue;
            bulletsRef.current.push({ id: `chart-${chartIdxRef.current}`, lane: c.lane, hitTime: c.hitTime, fallSec: slowAppr });
            const extra = b.rollExtraChartNote(Math.random);
            if (extra) {
              const extraLane = (c.lane + 1 + Math.floor(Math.random() * (LANES.length - 1))) % LANES.length;
              bulletsRef.current.push({ id: `chart-extra-${chartIdxRef.current}`, lane: extraLane, hitTime: c.hitTime + extra.delaySec, fallSec: slowAppr });
            }
          }
        } else {
          // ── 備援固定間隔模式(對照 spawnBossWave 依階段變速)── chart
          // 還在載入中(`chartLoadedRef.current === null`)或確定拿不到
          // (`=== false`)都走這條路徑。
          if (now - lastBulletAtRef.current >= b.bulletIntervalMs()) {
            lastBulletAtRef.current = now;
            // 2026-07-15n 修正(同 PlayScene.jsx 那個 bug):要比對的是這波
            // 新彈幕實際會落下的時間點(`t + APPROACH_SEC`),不是現在的
            // `t`,否則反堆疊完全沒作用。
            const landTime = t + APPROACH_SEC;
            const isLaneFree = (lane) => !bulletsRef.current.some((n) => Math.abs(n.hitTime - landTime) < 0.4 && n.lane === lane);
            const wave = b.spawnWave(t, { isLaneFree, slowActive, rand: Math.random });
            for (const w of wave) bulletsRef.current.push({ id: `bullet-${now}-${w.lane}-${Math.random().toString(36).slice(2, 6)}`, lane: w.lane, hitTime: w.hitTime, fallSec: w.fallSec });
          }
        }
        // 特殊招式(訊號干擾/口水噴濺)——兩種彈幕模式都會觸發,對照原始碼
        // `bossSpecial` 本來就是獨立於彈幕來源之外的另一條 timer。
        if (now - lastSpecialAtRef.current >= b.specialIntervalMs()) {
          lastSpecialAtRef.current = now;
          const move = b.rollSpecialMove(Math.random);
          const bullets = b.specialMoveBullets(move, t, { rand: Math.random, slowActive });
          for (const bl of bullets) bulletsRef.current.push({ id: `special-${now}-${bl.lane}-${Math.random().toString(36).slice(2, 6)}`, lane: bl.lane, hitTime: bl.hitTime, fallSec: bl.fallSec });
          showNotice(move === "signal" ? "📶 訊號很差啦!" : "💧 口水噴濺 · 看不清了!");
        }
      }

      // 過期彈幕自動 miss
      const stillAlive = [], expired = [];
      for (const n of bulletsRef.current) { if (t > n.hitTime + WINDOW_GOOD) expired.push(n); else stillAlive.push(n); }
      if (expired.length) {
        bulletsRef.current = stillAlive;
        for (const n of expired) applyBossHit("miss", n.lane);
      }

      // 公事包長按 QTE
      let holdUiNext = null;
      if (b.hold) {
        const isHeld = heldLanesRef.current.has(b.hold.lane);
        b.tickHold(deltaMs, isHeld);
        holdUiNext = { ...b.hold };
        if (now >= b.hold.deadline) {
          const invincible = now < b.playerInvincibleUntil;
          const result = b.resolveHold(now, { invincible });
          holdUiNext = null;
          setBossHp(b.hp); setPlayerHp(b.playerHp);
          showNotice(result.success ? "💼 撐住了!最後一擊命中!" : "💼 差一點!公事包反彈重擊了你!");
          if (result.success) {
            const { x, y } = laneToPx(2, 0.5);
            emitParticlePreset(particleRef.current, "explosion", x, y);
          }
          b.checkDeath();
        }
      }

      // 平衡對抗閘門(←/→ 抵抗方向鍵)
      let gateUiNext = null;
      if (b.gate) {
        const counterActive = heldDirRef.current != null && OPP_DIR[b.gate.push] === heldDirRef.current;
        const wrongActive = heldDirRef.current === b.gate.push;
        b.advanceGate(now, { counterActive, wrongActive });
        gateUiNext = { push: b.gate.push, pct: Math.min(1, b.gate.heldMs / b.gate.needMs) };
        if (now >= b.gate.deadline) {
          const invincible = now < b.playerInvincibleUntil;
          const result = b.resolveGate(now, { invincible });
          gateUiNext = null;
          setPlayerHp(b.playerHp);
          showNotice(result.met ? `⚖ 撐住了!+${Math.round(result.heal)} HP` : "⚖ 沒撐住,BOSS 反撲!");
        }
      }

      const outcomeNow = b.checkDeath();
      if (outcomeNow === "lose" && !reviveOfferedRef.current) {
        setOutcome(outcomeNow);
        setBossHp(b.hp); setPlayerHp(b.playerHp);
        reviveOfferedRef.current = true;
        setReviveAsk(true);
      }
      if (outcomeNow === "win" && !winHandledRef.current) {
        winHandledRef.current = true;
        setOutcome(outcomeNow);
        setBossHp(b.hp); setPlayerHp(b.playerHp);
        // 對照原始碼 endBoss() 給哩程獎勵,簡化版公式(這個場景是獨立
        // demo,沒有「已通過幾站」的關卡進度脈絡,原始碼是
        // `floor(score/1000 * max(1,clearedStations)) + 50`,這裡拿掉
        // clearedStations 那段乘數,只留 `floor(score/1000) + 50`)。
        const save = loadSave();
        // 讀 engine 內部即時 score(同一份物件參照),不是閉包裡的 `score`
        // React state——這個 `tick` 函式只在掛載時建立一次,閉包裡的
        // `score` 永遠是初始值 0(跟 `PlayScene.jsx` 修過的 stale closure
        // 是同一個坑)。
        const liveScore = engineRef.current.getState().score;
        const pts = Math.floor(liveScore / 1000) + 50;
        save.points += pts;
        save.stats.bossKills = (save.stats.bossKills || 0) + 1;
        writeSave(save);
        showNotice(`🎉 討伐成功 · 哩程 +${pts}`);
        if (onFinished) onFinished({ ...engineRef.current.getState(), outcome: "win", bossId });
      }

      const camState = camera.getState(now);
      const { x: sx, y: sy, rotate } = shake.getOffset(now);
      const view = viewRef.current;
      view.bullets = bulletsRef.current;
      view.holdUi = holdUiNext;
      view.gateUi = gateUiNext;
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

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onKeyDown = (e) => {
      const itemKey = ITEM_KEY_MAP[e.key];
      if (itemKey) { activateItem(itemKey, performance.now()); return; }
      const laneIdx = KEY_TO_LANE[e.key.toLowerCase()];
      if (laneIdx !== undefined) {
        heldLanesRef.current.add(laneIdx);
        if (!bossRef.current.hold && !bossRef.current.gate && !bossRef.current.outcome) {
          const now = performance.now();
          const t = (now - startPerfRef.current) / 1000;
          engineRef.current.hit({
            laneIdx, beatTime: t, rawBeatClock: t, nowMs: now, phase: "boss",
            notes: bulletsRef.current, bombs: [], noise: [],
          });
        }
      }
      if (e.key === "ArrowLeft") heldDirRef.current = "left";
      else if (e.key === "ArrowRight") heldDirRef.current = "right";
    };
    const onKeyUp = (e) => {
      const laneIdx = KEY_TO_LANE[e.key.toLowerCase()];
      if (laneIdx !== undefined) heldLanesRef.current.delete(laneIdx);
      if (e.key === "ArrowLeft" && heldDirRef.current === "left") heldDirRef.current = null;
      if (e.key === "ArrowRight" && heldDirRef.current === "right") heldDirRef.current = null;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(noticeTimerRef.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 對照原始碼 confirmRevive():真的檢查/扣存檔哩程點數(不再是 demo 假值)。
  const doRevive = () => {
    const now = performance.now();
    const save = loadSave();
    const result = bossRef.current.revive(now, { points: save.points, cost: REVIVE_COST });
    if (!result.ok) {
      showNotice(result.reason === "points" ? `哩程不足(還差 ${REVIVE_COST - save.points} 點),沒辦法復活` : "已經用過一次復活機會了");
      return;
    }
    save.points -= REVIVE_COST;
    writeSave(save);
    reviveOfferedRef.current = false;
    setReviveAsk(false);
    setOutcome(null);
    setPlayerHp(bossRef.current.playerHp);
    // ⚠️ 2026-07-15t 補上:對照原始碼 `confirmRevive()`(3387 行)——復活
    // 接關除了回滿血、給 3 秒無敵(這兩個 `bossManager.revive()` 內部已經
    // 處理),還會「必殺集氣全滿」當作復活獎勵的一部分,之前漏接這個效果。
    // ⚠️ 道具「充能次數」原始碼註解明講「死亡演出中沒有被清空,不用額外
    // 處理」——這裡本來就沒有動 `itemsRef.current.charges`,維持死亡前的
    // 數量,是對的,不要加。
    itemsRef.current.expressCharge = EXPRESS_NEED;
    itemsRef.current.expressReady = true;
    showNotice(`哩程 -${REVIVE_COST} · 復活成功 · 必殺集氣全滿 · 3 秒無敵!(剩餘哩程 ${save.points})`);
  };
  const doRetry = () => {
    bossRef.current.retry();
    bulletsRef.current = [];
    bossComboRef.current = 0;
    reviveOfferedRef.current = false;
    winHandledRef.current = false;
    engineRef.current.setBossCombo(0);
    engineRef.current.reset();
    setOutcome(null); setReviveAsk(false); setScore(0);
    setBossHp(100); setPlayerHp(100); setPhase(1);
  };

  // 肉鴿卡(demo)——這個場景只有 finalsprint(終點衝刺:BOSS 傷害 +30%)
  // 真的有作用(其他卡的效果屬於一般行駛階段/道具系統,見
  // `PlayScene.jsx`),但抽卡池/選卡流程共用同一套 `judge/rogue.js`。
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
    showNotice(`🎴 選了「${card.name}」`);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0D10", color: "#8FE0FF",
      fontFamily: "-apple-system, system-ui, sans-serif", padding: 20,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>共GO · BOSS 對戰場(Phase 9 接線)</div>
          <Button variant="ghost" onClick={onExit}>離開</Button>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 8, alignItems: "center" }}>
          <span>分數 <b>{score}</b></span>
          <span>階段 <b style={{ color: "#FF9F45" }}>P{phase}</b></span>
          <Button variant="ghost" style={{ fontSize: 11, marginLeft: "auto" }} onClick={rollRogue}>
            🎴 抽卡(demo){rogueCardIds.length > 0 ? ` · ${rogueCardIds.length} 張` : ""}
          </Button>
        </div>

        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>BOSS HP {bossHp.toFixed(1)}</div>
          <ProgressBar value={bossHp / 100} color="#FF3C3C" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>玩家 HP {playerHp.toFixed(1)}</div>
          <ProgressBar value={playerHp / 100} />
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

        <div ref={fieldBoxRef} style={{
          position: "relative", height: FALL_DISTANCE + 40, borderRadius: 12,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(226,75,74,0.25)",
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
            <div style={{ position: "absolute", left: 0, right: 0, top: FALL_DISTANCE, height: 2, background: "#FFFFFF", opacity: 0.5 }} />
            {viewRef.current.bullets.map((n) => {
              const progress = Math.max(0, Math.min(1.05, 1 - (n.hitTime - beatClockRef.current) / (n.fallSec || APPROACH_SEC)));
              return (
                <div key={n.id} style={{
                  position: "absolute", left: `calc(${laneLeftExpr(n.lane)})`, width: `calc(${laneWidthExpr})`,
                  top: progress * FALL_DISTANCE, display: "flex", justifyContent: "center",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#FF3C3C", boxShadow: "0 0 10px #FF6A6A" }} />
                </div>
              );
            })}
          </div>
          <LightingLayer lighting={lightingRef.current} style={{ position: "absolute", inset: 0 }} />
          <ParticleLayer pm={particleRef.current} style={{ position: "absolute", inset: 0 }} />
          <FxLayer fx={fx} style={{ position: "absolute", inset: 0 }} />

          {viewRef.current.holdUi && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8,
              background: "rgba(8,10,13,0.72)", zIndex: 20,
            }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD700" }}>
                💼 {viewRef.current.holdUi.isFinisher ? "最後一擊!長壓接住公事包!" : "長壓接住!"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>按住 {LANES[viewRef.current.holdUi.lane]?.keyChar} 鍵</div>
              <div style={{ width: 200 }}>
                <ProgressBar value={viewRef.current.holdUi.held / viewRef.current.holdUi.need} color="#FFD700" />
              </div>
            </div>
          )}
          {viewRef.current.gateUi && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 8,
              background: "rgba(8,10,13,0.72)", zIndex: 20,
            }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#3FE0FF" }}>⚖ 平衡對抗!</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                按住 {viewRef.current.gateUi.push === "left" ? "→(往右抵抗)" : "←(往左抵抗)"}
              </div>
              <div style={{ width: 200 }}>
                <ProgressBar value={viewRef.current.gateUi.pct} color="#3FE0FF" />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          {LANES.map((lane) => (<div key={lane.key}>{lane.keyChar} · {lane.label}</div>))}
        </div>
      </div>

      <Dialog open={reviveAsk} title="你被擊倒了" actions={
        <>
          <Button variant="primary" onClick={doRevive}>復活接關(demo)</Button>
          <Button variant="secondary" onClick={doRetry}>重新挑戰</Button>
          <Button variant="ghost" onClick={() => (onFinished ? onFinished({ ...engineRef.current.getState(), outcome: "lose", bossId }) : onExit())}>我要下車</Button>
        </>
      }>
        <div style={{ fontSize: 13, color: "#C0C8D0", textAlign: "left", width: "100%" }}>
          要復活接關、重新挑戰、還是先下車?(demo 版沒有接存檔哩程點數檢查)
        </div>
      </Dialog>

      <Dialog open={outcome === "win"} title="🎉 討伐成功">
        <div style={{ fontSize: 13, color: "#C0C8D0", textAlign: "center", width: "100%", marginBottom: 10 }}>
          分數 {score}
        </div>
        <Button variant="primary" onClick={doRetry} style={{ width: "100%", marginBottom: 8 }}>再戰一次</Button>
        <Button variant="ghost" onClick={onExit} style={{ width: "100%" }}>回月台</Button>
      </Dialog>

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
