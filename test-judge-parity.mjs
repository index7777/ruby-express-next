// Trace / parity 測試:同一組 input 序列同時餵給 gameEngine.js(新橋接設計)
// 與 legacyReferenceModel.js(獨立轉譯,逐字對照原始碼),比對每一步的
// callback/log 呼叫序列 + 最終 score/combo/stability/counts 是否完全一致。
//
// 這是 Step 3(驗證一致性)。誠實聲明:兩份模型都是我讀 web-build/index.html
// 轉譯出來的,不是瀏覽器實錄——這裡抓的是「重構本身有沒有跟另一份獨立轉譯
// 對不上」,不是「跟真正的原始碼行為完全一致」,那個仍需要你在本機瀏覽器
// 實測確認(尤其是分數/連段數字要跟舊版 web-build/ 實測結果核對一次)。

import { createGameEngine } from "./src/systems/judge/gameEngine.js";
import { makeRefs, judgeLane as legacyJudgeLane, recoverFromImbalance as legacyRecover } from "./src/systems/judge/legacyReferenceModel.js";

let pass = 0, fail = 0;
function assertEqual(a, b, label) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) { pass++; return; }
  fail++;
  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    let idx = -1;
    for (let i = 0; i < len; i++) {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { idx = i; break; }
    }
    console.error(`FAIL: ${label} (first diff at index ${idx} of ${a.length}/${b.length})`);
    const lo = Math.max(0, idx - 2), hi = Math.min(len, idx + 3);
    for (let i = lo; i < hi; i++) {
      console.error(`  [${i}] engine=${JSON.stringify(a[i])}  legacy=${JSON.stringify(b[i])}`);
    }
  } else {
    console.error(`FAIL: ${label}\n  engine : ${sa}\n  legacy : ${sb}`);
  }
}

// 簡單可重現的 PRNG(mulberry32),固定 seed 確保每次跑結果一樣
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGameEngineLog() {
  const log = [];
  const cb = {
    onScoreDelta: (d) => log.push(["score", d]),
    onCountIncrement: () => {},
    onComboChange: (v) => log.push(["combo", v]),
    onStabilityChange: (v) => log.push(["stability", v]),
    onNoteConsumed: (id) => log.push(["notesRemove", id]),
    onBombConsumed: (id) => log.push(["bombsRemove", id]),
    onNoiseConsumed: (id) => log.push(["noiseRemove", id]),
    onLaneFlash: (l, k) => log.push(["flashLane", l, k]),
    onFloater: (l, t, c) => log.push(["floater", l, t, c]),
    onLaneBurst: (l) => log.push(["laneBurst", l]),
    onPlayDrum: (l, cat) => log.push(["playDrum", l, cat]),
    onPlayComboFanfare: () => log.push(["comboFanfare"]),
    onVibrate: (p) => log.push(["vibrate", p]),
    onComboMilestoneFx: (t) => log.push(["comboMilestoneFx", t]),
    onBossHit: (cat) => log.push(["bossApplyHit", cat]),
    onExpressCharge: (cat, combo) => log.push(["expressCharge", cat, combo]),
    onSevereImbalanceTriggered: (recoverAt) => log.push(["severeImbalance", recoverAt]),
    onStaffMissDuring: () => log.push(["staffMissDuring"]),
    onStreaksChanged: () => {},
    onDoubleNoteHit: () => {},
  };
  return { log, cb };
}

function runScenario(label, steps) {
  const { log: logA, cb } = makeGameEngineLog();
  const engine = createGameEngine(cb);
  const logB = [];
  const refs = makeRefs();

  for (const step of steps) {
    if (step.type === "hit") {
      engine.hit(step.input);
      legacyJudgeLane(refs, step.input, logB);
    } else if (step.type === "setRogue") {
      engine.setRogue(step.patch);
      refs.rogueRef.current = { ...refs.rogueRef.current, ...step.patch };
    } else if (step.type === "setItems") {
      engine.setItems(step.patch);
      refs.itemRefs.current = { ...refs.itemRefs.current, ...step.patch };
    } else if (step.type === "setBuffMissImmuneUntil") {
      engine.setBuffMissImmuneUntil(step.t);
      refs.buffMissImmuneUntilRef.current = step.t;
    } else if (step.type === "setBuffGoodToPerfectUntil") {
      engine.setBuffGoodToPerfectUntil(step.t);
      refs.buffGoodToPerfectUntilRef.current = step.t;
    } else if (step.type === "setBossCombo") {
      engine.setBossCombo(step.v);
      refs.bossComboRef.current = step.v;
    } else if (step.type === "setPractice") {
      engine.setPractice(step.v);
      refs.practiceRef.current = step.v;
    } else if (step.type === "recover") {
      engine.recoverFromImbalance(step.nowMs);
      legacyRecover(refs, logB);
    }
  }

  assertEqual(logA, logB, `${label}: log trace`);
  const st = engine.getState();
  assertEqual(
    { score: st.score, combo: st.combo, maxCombo: st.maxCombo, stability: st.stability, counts: st.counts, fullComboMiss: st.fullComboMiss },
    { score: refs.scoreRef.current, combo: refs.comboRef.current, maxCombo: refs.maxComboRef.current, stability: refs.stabilityRef.current, counts: refs.countsRef.current, fullComboMiss: refs.fullComboMissRef.current },
    `${label}: final state`
  );
}

function hitInput({ laneIdx, beatTime, rawBeatClock = beatTime, nowMs, phase = "running", notes = [], bombs = [], noise = [] }) {
  return { type: "hit", input: { laneIdx, beatTime, rawBeatClock, nowMs, phase, notes, bombs, noise } };
}

// ── 場景 1:一般命中,涵蓋 perfect/great/good/miss/空軌,一路打到 combo 500+ ──
{
  const steps = [];
  let t = 0, nowMs = 0;
  const offsets = [0, 0.02, 0.08, 0.13, 0.3, 0.02, 0.02, 0.02]; // perfect/perfect/great/good/miss(超窗)/perfect...
  for (let i = 0; i < 520; i++) {
    const off = offsets[i % offsets.length];
    const hitTime = t;
    const note = { id: "n" + i, lane: i % 5, hitTime };
    steps.push(hitInput({ laneIdx: i % 5, beatTime: hitTime + off, nowMs, phase: "running", notes: [note] }));
    t += 0.5; nowMs += 500;
  }
  runScenario("一般命中(含里程碑 50/100/200/300/500)", steps);
}

// ── 場景 2:空軌互動(不應觸發任何分數/連段變化,純粹當 regression)──
{
  const steps = [];
  let nowMs = 0;
  for (let i = 0; i < 20; i++) {
    steps.push(hitInput({ laneIdx: 0, beatTime: 100 + i, nowMs, phase: "running", notes: [] }));
    nowMs += 300;
  }
  runScenario("空軌互動 regression", steps);
}

// ── 場景 2b:真正用炸彈連續命中製造嚴重失衡 + recover ──
{
  const steps = [];
  let nowMs = 1000;
  for (let i = 0; i < 15; i++) {
    const bomb = { id: "b" + i, lane: 2, hitTime: 50 + i };
    steps.push(hitInput({ laneIdx: 2, beatTime: 50 + i, nowMs, phase: "running", bombs: [bomb] }));
    nowMs += 200;
  }
  // 失衡 lockout 期間再打一次(應該被鎖住,只 flash miss)
  steps.push(hitInput({ laneIdx: 1, beatTime: 999, nowMs: nowMs + 10, phase: "running", notes: [{ id: "locked", lane: 1, hitTime: 999 }] }));
  // 2 秒後恢復
  steps.push({ type: "recover", nowMs: nowMs + 2000 });
  runScenario("連續炸彈觸發嚴重失衡 + lockout + recover", steps);
}

// ── 場景 3:BOSS 分支,含 bossCombo 門檻(10/20)+ 墨鏡 buff 放大 perfect 窗 ──
{
  const steps = [];
  let nowMs = 0;
  steps.push({ type: "setRogue", patch: { perfWindowMult: 1.5 } });
  steps.push({ type: "setItems", patch: { sunglasses: { activeUntil: 999999 } } });
  for (let i = 0; i < 25; i++) {
    steps.push({ type: "setBossCombo", v: i });
    const note = { id: "bn" + i, lane: i % 5, hitTime: i * 0.4 };
    steps.push(hitInput({ laneIdx: i % 5, beatTime: i * 0.4 + 0.03, rawBeatClock: i * 0.4 + 0.03, nowMs, phase: "boss", notes: [note] }));
    nowMs += 400;
  }
  // boss 分支空軌(找不到音符)
  steps.push(hitInput({ laneIdx: 3, beatTime: 999, nowMs: nowMs + 10, phase: "boss", notes: [] }));
  runScenario("BOSS 分支(墨鏡放大窗 + combo 門檻 10/20 分數倍率)", steps);
}

// ── 場景 4:雙軌音符,同時按(命中)vs 分開按太久(不算) ──
{
  const steps = [];
  const doubleNote = { id: "d1", lane: 1, doubleLane: 3, kind: "double", hitTime: 10 };
  steps.push(hitInput({ laneIdx: 1, beatTime: 10.01, nowMs: 5000, notes: [doubleNote] }));
  steps.push(hitInput({ laneIdx: 3, beatTime: 10.02, nowMs: 5050, notes: [doubleNote] })); // 50ms 內,算同時按下 → 命中
  const doubleNote2 = { id: "d2", lane: 0, doubleLane: 2, kind: "double", hitTime: 20 };
  steps.push(hitInput({ laneIdx: 0, beatTime: 20.01, nowMs: 9000, notes: [doubleNote2] }));
  steps.push(hitInput({ laneIdx: 2, beatTime: 20.02, nowMs: 9500, notes: [doubleNote2] })); // 500ms,超過 140ms → 不算同時
  runScenario("雙軌音符(同時按命中 vs 間隔太久不算)", steps);
}

// ── 場景 5:雜訊符號 + 列車長 miss 免疫 buff ──
{
  const steps = [];
  steps.push({ type: "setBuffMissImmuneUntil", t: 999999 });
  const noise = { id: "nz1", lane: 4, hitTime: 5 };
  steps.push(hitInput({ laneIdx: 4, beatTime: 5.02, nowMs: 100, noise: [noise] }));
  steps.push(hitInput({ laneIdx: 0, beatTime: 5, nowMs: 200, notes: [] }));
  runScenario("雜訊符號 + miss 免疫 buff(SAVED)", steps);
}

// ── 場景 6:警察 buff(good→perfect)+ autoPerfect 開場鎖輸入 ──
{
  const steps = [];
  steps.push({ type: "setBuffGoodToPerfectUntil", t: 999999 });
  const note = { id: "gp1", lane: 2, hitTime: 3 };
  steps.push(hitInput({ laneIdx: 2, beatTime: 3.12, nowMs: 50, notes: [note] })); // diff=0.12 → 原本 good,buff 後變 perfect
  steps.push({ type: "setRogue", patch: { autoPerfect: true } });
  const lockedNote = { id: "lock1", lane: 0, hitTime: 3 };
  steps.push(hitInput({ laneIdx: 0, beatTime: 3.02, rawBeatClock: 5, nowMs: 100, notes: [lockedNote] })); // rawBeatClock<12 → 鎖輸入,不判定
  const unlockedNote = { id: "unlock1", lane: 0, hitTime: 20 };
  steps.push(hitInput({ laneIdx: 0, beatTime: 20.02, rawBeatClock: 13, nowMs: 200, notes: [unlockedNote] })); // rawBeatClock>=12 → 正常判定
  runScenario("警察 buff(good→perfect)+ autoPerfect 開場鎖輸入", steps);
}

// ── 場景 7:seeded 隨機 fuzz(200 次隨機命中,混合各種 lane/timing/phase)──
{
  const rnd = mulberry32(20260715);
  const steps = [];
  let nowMs = 0;
  for (let i = 0; i < 200; i++) {
    const lane = Math.floor(rnd() * 5);
    const hitTime = i * 0.3;
    const offset = (rnd() - 0.5) * 0.4; // -0.2 ~ +0.2 涵蓋 perfect/great/good/miss(超窗)
    const phase = rnd() < 0.15 ? "boss" : "running";
    const note = { id: "f" + i, lane, hitTime };
    steps.push(hitInput({ laneIdx: lane, beatTime: hitTime + offset, nowMs, phase, notes: [note] }));
    nowMs += 300;
  }
  runScenario("seeded 隨機 fuzz(200 次混合命中)", steps);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
