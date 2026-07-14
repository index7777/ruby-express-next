// legacyReferenceModel —— 驗證用的「逐字對照」模型,不是給正式遊戲用的程式碼。
//
// 目的:Step 3(驗證一致性)需要一個跟 gameEngine.js 分開撰寫的比對基準,
// 這裡刻意維持跟 web-build/index.html 原始寫法(單一大函式、原始變數命名、
// 原始分支順序)更接近的樣子,而不是套用 gameEngine.js 那種拆分過的結構,
// 讓兩邊真的是「兩份獨立轉譯」,而不是同一份程式碼複製兩次。
//
// ⚠️ 誠實聲明其限制:這份模型跟 gameEngine.js 一樣,都是我逐行閱讀
// `web-build/index.html` 之後手動轉譯的結果,**不是**從瀏覽器實際執行
// 錄下來的 trace。如果我對原始碼的理解本身就有誤,這份模型會跟
// gameEngine.js 一起錯在同一個地方,測試也抓不出來——這點自動化測試
// 沒辦法保證,只有你在本機瀏覽器實測、拿真正的分數/連段數字回報,才是
// 最終基準。這裡的 parity 測試保證的是「gameEngine.js 這次重構本身有沒有
// 不小心跟原始邏輯的另一份轉譯對不上」,用來抓重構動作造成的行為漂移,
// 不是用來背書「這就是原始碼的正確行為」。
//
// 對應原始碼位置:registerHit(1656-1724)/judgeLane(1726-1837)/
// applyStabilityDelta(1582)/triggerSevereImbalance(1597)。

import { WINDOW_PERFECT, WINDOW_GREAT, WINDOW_GOOD, JUDGE_LABEL, NOISE_SCORE, multiplierFor } from "../config/index.js";

export function makeRefs() {
  // 用一個大物件模擬原始碼裡散落的一堆 useRef/useState,key 名稱刻意
  // 貼近原始 ref 變數名稱,方便對照 DEPENDENCY_ANALYSIS.md。
  return {
    scoreRef: { current: 0 },
    comboRef: { current: 0 },
    maxComboRef: { current: 0 },
    stabilityRef: { current: 100 },
    countsRef: { current: { perfect: 0, great: 0, good: 0, miss: 0 } },
    imbalanceUntilRef: { current: 0 },
    imbalanceKindRef: { current: "" },
    penaltyLockRef: { current: false },
    buffMissImmuneUntilRef: { current: 0 },
    buffGoodToPerfectUntilRef: { current: 0 },
    perfectStreakRef: { current: 0 },
    greatPlusStreakRef: { current: 0 },
    comboMilestoneRef: { current: 0 },
    visualMilestoneRef: { current: 0 },
    comboHealRef: { current: 0 },
    fullComboMissRef: { current: 0 },
    bossComboRef: { current: 0 },
    doubleNotePendingRef: { current: {} },
    practiceRef: { current: false },
    rogueRef: {
      current: {
        autoPerfect: false, perfWindowMult: 1, missMult: 1, scoreMult: 1,
        perfMult: 1, perfectBonus: 0, comboRecover: false, stabFloor: 0,
        missStabExtra: 0,
      },
    },
    itemRefs: { current: { sunglasses: { activeUntil: 0 } } },
  };
}

// 對應 1582 行 applyStabilityDelta
function applyStabilityDelta(refs, delta, source, nowMs, log) {
  if (refs.practiceRef.current && delta < 0) return;
  if (delta < 0 && source === "miss" && nowMs < refs.imbalanceUntilRef.current) return;
  refs.stabilityRef.current = (() => {
    const floor = refs.rogueRef.current.stabFloor || 0;
    const next = Math.max(floor, Math.min(100, refs.stabilityRef.current + delta));
    if (next <= 0 && source === "miss" && !refs.penaltyLockRef.current) triggerSevereImbalance(refs, nowMs, log);
    return next;
  })();
  log.push(["stability", refs.stabilityRef.current]);
}

// 對應 1597 行 triggerSevereImbalance(setTimeout 部分交給呼叫端,見 recoverFromImbalance)
function triggerSevereImbalance(refs, nowMs, log) {
  log.push(["vibrate", [120, 60, 120, 60, 180]]);
  refs.penaltyLockRef.current = true;
  refs.imbalanceUntilRef.current = nowMs + 2000;
  refs.imbalanceKindRef.current = "severe";
  log.push(["severeImbalance", nowMs + 2000]);
}

export function recoverFromImbalance(refs, log) {
  refs.stabilityRef.current = Math.min(100, refs.stabilityRef.current + 20);
  refs.penaltyLockRef.current = false;
  refs.imbalanceKindRef.current = "";
  log.push(["stability", refs.stabilityRef.current]);
}

// 對應 1656-1724 行 registerHit
function registerHit(refs, lane, category, isChartNote, nowMs, log) {
  log.push(["playDrum", lane, category]);
  if (category === "perfect") log.push(["vibrate", 15]);
  else if (category === "great") log.push(["vibrate", 10]);
  else if (category === "good") log.push(["vibrate", 8]);
  else log.push(["vibrate", [25, 40, 25]]);

  refs.countsRef.current = { ...refs.countsRef.current, [category]: refs.countsRef.current[category] + 1 };

  if (category === "miss") {
    if (nowMs < refs.buffMissImmuneUntilRef.current) {
      log.push(["flashLane", lane, "great"]);
      log.push(["floater", lane, "SAVED", "#7CFFB0"]);
      return;
    }
    if (isChartNote) refs.fullComboMissRef.current += 1;
    log.push(["staffMissDuring"]);
    refs.comboRef.current = 0;
    log.push(["combo", 0]);
    refs.comboMilestoneRef.current = 0;
    refs.visualMilestoneRef.current = 0;
    refs.perfectStreakRef.current = 0;
    refs.greatPlusStreakRef.current = 0;
    applyStabilityDelta(refs, -6 * refs.rogueRef.current.missMult - (refs.rogueRef.current.missStabExtra || 0), "miss", nowMs, log);
    log.push(["flashLane", lane, "miss"]);
    log.push(["floater", lane, JUDGE_LABEL.miss, "#FF2222"]);
    return;
  }

  if (category === "perfect") { refs.perfectStreakRef.current += 1; refs.greatPlusStreakRef.current += 1; }
  else if (category === "great") { refs.perfectStreakRef.current = 0; refs.greatPlusStreakRef.current += 1; }
  else { refs.perfectStreakRef.current = 0; refs.greatPlusStreakRef.current = 0; }

  const nextCombo = refs.comboRef.current + 1;
  refs.comboRef.current = nextCombo;
  refs.maxComboRef.current = Math.max(refs.maxComboRef.current, nextCombo);
  log.push(["combo", nextCombo]);

  const mult = multiplierFor(nextCombo);
  const base = category === "perfect" ? 100 : category === "great" ? 60 : 30;
  const rg = refs.rogueRef.current;
  const scoreDelta = Math.round(base * mult * rg.scoreMult * (category === "perfect" ? rg.perfMult : 1)) + (category === "perfect" ? (rg.perfectBonus || 0) : 0);
  refs.scoreRef.current += scoreDelta;
  log.push(["score", scoreDelta]);

  const milestones = [50, 100, 500];
  for (const m of milestones) {
    if (nextCombo >= m && refs.comboMilestoneRef.current < m) {
      refs.comboMilestoneRef.current = m;
      log.push(["comboFanfare"]);
      break;
    }
  }
  const COMBO_MILESTONES = [50, 100, 200, 300];
  for (const vm of COMBO_MILESTONES) {
    if (nextCombo >= vm && refs.visualMilestoneRef.current < vm) {
      refs.visualMilestoneRef.current = vm;
      log.push(["comboMilestoneFx", vm]);
      break;
    }
  }

  if (category === "perfect") applyStabilityDelta(refs, 1.5, undefined, nowMs, log);
  if (category === "perfect" && rg.comboRecover) {
    if (nowMs - refs.comboHealRef.current >= 3000) { applyStabilityDelta(refs, 1, undefined, nowMs, log); refs.comboHealRef.current = nowMs; }
  }
  if (category === "great") applyStabilityDelta(refs, 1, undefined, nowMs, log);
  if (category === "good") applyStabilityDelta(refs, -1, undefined, nowMs, log);

  log.push(["expressCharge", category, refs.comboRef.current]);
  log.push(["flashLane", lane, category]);
  log.push(["floater", lane, JUDGE_LABEL[category], category === "perfect" ? "#FFD700" : category === "great" ? "#63C2FF" : "#C0C8D0"]);
}

// 對應 1726-1837 行 judgeLane
export function judgeLane(refs, input, log) {
  const { laneIdx, beatTime, rawBeatClock, nowMs, phase, notes, bombs, noise } = input;
  if (nowMs < refs.imbalanceUntilRef.current) { log.push(["flashLane", laneIdx, "miss"]); return; }
  if (phase !== "boss" && refs.rogueRef.current.autoPerfect && rawBeatClock < 12) return;

  const pwin = WINDOW_PERFECT * (((refs.rogueRef.current.perfWindowMult || 1) > 1 && refs.itemRefs.current.sunglasses.activeUntil > nowMs) ? refs.rogueRef.current.perfWindowMult : 1);

  if (phase === "boss") {
    const tb = beatTime;
    const cands = notes.filter((n) => n.lane === laneIdx);
    let best = null, bd = Infinity;
    for (const c of cands) { const d = Math.abs(tb - c.hitTime); if (d < bd) { best = c; bd = d; } }
    if (best && bd <= WINDOW_GOOD) {
      let cat = bd <= pwin ? "perfect" : bd <= WINDOW_GREAT ? "great" : "good";
      if (cat === "good" && nowMs < refs.buffGoodToPerfectUntilRef.current) cat = "perfect";
      log.push(["notesRemove", best.id]);
      refs.countsRef.current = { ...refs.countsRef.current, [cat]: refs.countsRef.current[cat] + 1 };
      log.push(["playDrum", laneIdx, cat]);
      log.push(["flashLane", laneIdx, cat]);
      log.push(["floater", laneIdx, JUDGE_LABEL[cat], cat === "perfect" ? "#FFD700" : cat === "great" ? "#63C2FF" : "#C0C8D0"]);
      log.push(["bossApplyHit", cat]);
      const bmult = refs.bossComboRef.current >= 20 ? 1.5 : refs.bossComboRef.current >= 10 ? 1.2 : 1;
      const bbase = cat === "perfect" ? 100 : cat === "great" ? 60 : 30;
      const scoreDelta = Math.round(bbase * bmult * (refs.rogueRef.current.scoreMult || 1)) + (cat === "perfect" ? (refs.rogueRef.current.perfectBonus || 0) : 0);
      refs.scoreRef.current += scoreDelta;
      log.push(["score", scoreDelta]);
      log.push(["expressCharge", cat, refs.bossComboRef.current]);
      return;
    }
    log.push(["playDrum", laneIdx, "good"]);
    log.push(["laneBurst", laneIdx]);
    return;
  }

  if (phase !== "running") return;
  const t = beatTime;

  const doubleN = notes.find((n) => n.kind === "double" && (n.lane === laneIdx || n.doubleLane === laneIdx) && Math.abs(t - n.hitTime) <= WINDOW_GOOD);
  if (doubleN) {
    const p = refs.doubleNotePendingRef.current[doubleN.id] || {};
    p[laneIdx] = nowMs;
    refs.doubleNotePendingRef.current[doubleN.id] = p;
    const otherLane = laneIdx === doubleN.lane ? doubleN.doubleLane : doubleN.lane;
    if (p[otherLane] && Math.abs(p[laneIdx] - p[otherLane]) <= 140) {
      const diff = Math.abs(t - doubleN.hitTime);
      let cat = diff <= pwin ? "perfect" : diff <= WINDOW_GREAT ? "great" : "good";
      if (cat === "good" && nowMs < refs.buffGoodToPerfectUntilRef.current) cat = "perfect";
      log.push(["notesRemove", doubleN.id]);
      delete refs.doubleNotePendingRef.current[doubleN.id];
      registerHit(refs, doubleN.lane, cat, true, nowMs, log);
      registerHit(refs, doubleN.doubleLane, cat, true, nowMs, log);
      refs.scoreRef.current += 150;
      log.push(["score", 150]);
      log.push(["floater", doubleN.lane, "🧳 DOUBLE!", "#FFD43B"]);
      return;
    }
    log.push(["flashLane", laneIdx, "great"]);
    return;
  }

  const bomb = bombs.find((b) => b.lane === laneIdx && Math.abs(t - b.hitTime) <= WINDOW_GOOD);
  if (bomb) {
    log.push(["bombsRemove", bomb.id]);
    refs.comboRef.current = 0;
    log.push(["combo", 0]);
    refs.comboMilestoneRef.current = 0;
    refs.visualMilestoneRef.current = 0;
    refs.perfectStreakRef.current = 0;
    refs.greatPlusStreakRef.current = 0;
    applyStabilityDelta(refs, -8, undefined, nowMs, log);
    log.push(["vibrate", [30, 40, 30]]);
    log.push(["flashLane", laneIdx, "miss"]);
    log.push(["floater", laneIdx, "✕炸彈", "#FF3B3B"]);
    return;
  }

  const candidates = notes.filter((n) => n.lane === laneIdx);
  let best = null, bestDiff = Infinity;
  for (const c of candidates) { const d = Math.abs(t - c.hitTime); if (d < bestDiff) { best = c; bestDiff = d; } }
  if (best && bestDiff <= WINDOW_GOOD) {
    let category = bestDiff <= pwin ? "perfect" : bestDiff <= WINDOW_GREAT ? "great" : "good";
    if (category === "good" && nowMs < refs.buffGoodToPerfectUntilRef.current) category = "perfect";
    log.push(["notesRemove", best.id]);
    registerHit(refs, laneIdx, category, true, nowMs, log);
    return;
  }

  const nz = noise.find((n) => n.lane === laneIdx && Math.abs(t - n.hitTime) <= WINDOW_GOOD);
  if (nz) {
    log.push(["noiseRemove", nz.id]);
    log.push(["playDrum", laneIdx, "good"]);
    log.push(["vibrate", 8]);
    log.push(["flashLane", laneIdx, "great"]);
    refs.scoreRef.current += NOISE_SCORE;
    log.push(["score", NOISE_SCORE]);
    log.push(["floater", laneIdx, "+" + NOISE_SCORE, "#94D8FF"]);
    return;
  }

  log.push(["playDrum", laneIdx, "good"]);
  log.push(["laneBurst", laneIdx]);
}
