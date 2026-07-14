// GameEngine —— 判定核心的橋接設計實作(Bridge Pattern)。
//
// 對應原始碼:judgeLane(web-build/index.html 1726-1837)、registerHit
// (1656-1724)、applyStabilityDelta(1582)、triggerSevereImbalance(1597)。
// 完整依賴清單見 DEPENDENCY_ANALYSIS.md,型別總覽見 judgeLogic.interface.js。
//
// ── 三段式拆解 ──
//   Input   : JudgeInput —— 只有數據(laneIdx / beatTime / rawBeatClock /
//             nowMs / phase / notes / bombs / noise),沒有任何 React 物件。
//   Logic   : judgeCore() —— 純函式,(input, state, config) => {result, nextState}。
//             禁止 useState/useEffect/DOM/setTimeout/Date.now()/performance.now()——
//             所有時間一律由呼叫端當作 input 傳入,確保「同樣輸入 → 同樣輸出」
//             (Contract 1:Deterministic)。
//   Output  : callbacks —— judgeCore 算完後,GameEngine 依序呼叫對應的
//             callback 吐出結果,React(或未來的 Native 實作)只負責在
//             callback 觸發時更新畫面/播音效/震動(Contract 3)。
//
// GameEngine 類別本身持有「自己的」判定狀態(score/combo/stability/...),
// 但這**不是 React state**(Contract 2)——它是一個普通 JS 物件,呼叫端
// 要嘛直接用 `engine.getState()` 讀出來丟給 setState 顯示,要嘛用
// `engine.loadState(state)` 從存檔還原,引擎本身完全不知道 React 的存在。
//
// ── 刻意不在這裡做的事(範圍邊界,避免跟還沒搬的子系統提前耦合) ──
// - NPC 驅散(maybeDismissNpc 的 npcs/backpacks 清單過濾)留給未來 npc 系統,
//   這裡只維護 perfectStreak/greatPlusStreak 兩個計數並透過
//   `onStreaksChanged` 通知,不自己碰 npc 資料。
// - BOSS 傷害/連段(bossApplyHit/bossCombo 怎麼算)留給未來 boss 系統,
//   `bossCombo` 當成唯讀 input 傳進來(引擎不自己遞增),分數倍率計算
//   還是照抄原公式(10/20 門檻),因為那是「判定分數」的一部分。
// - 站務員事件(staffActiveRef.missDuring)只透過 `onStaffMissDuring`
//   通知,引擎不持有站務員事件狀態。
// - 嚴重失衡 2 秒後自動恢復,原本是 `setTimeout`——引擎不排時間,
//   只提供 `recoverFromImbalance(nowMs)` 給呼叫端在計時器到期時呼叫。

import { WINDOW_PERFECT, WINDOW_GREAT, WINDOW_GOOD, JUDGE_LABEL, NOISE_SCORE, multiplierFor } from "../config/index.js";

/** @returns {import("./judgeLogic.interface.js").JudgeState} */
export function createInitialJudgeState() {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    stability: 100,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    imbalanceUntil: 0,
    imbalanceKind: "",
    penaltyLock: false,
    buffMissImmuneUntil: 0,
    buffGoodToPerfectUntil: 0,
    perfectStreak: 0,
    greatPlusStreak: 0,
    comboMilestone: 0,
    visualMilestone: 0,
    comboHealAt: 0,
    fullComboMiss: 0,
    bossCombo: 0,
    doubleNotePending: {},
    practice: false,
    rogue: {
      autoPerfect: false, perfWindowMult: 1, missMult: 1, scoreMult: 1,
      perfMult: 1, perfectBonus: 0, comboRecover: false, stabFloor: 0,
      missStabExtra: 0,
    },
    items: { sunglasses: { activeUntil: 0 } },
  };
}

const COMBO_SCORE_MILESTONES = [50, 100, 500]; // 原 registerHit 1697 行 fanfare 門檻
const VISUAL_MILESTONES = [50, 100, 200, 300];  // 原 COMBO_MILESTONES(視覺特效門檻)
const DOUBLE_NOTE_SIMUL_MS = 140;               // 原 1777 行
const AUTO_PERFECT_WINDOW_SEC = 12;             // 原 1740 行
const BASE_SCORE = { perfect: 100, great: 60, good: 30 };
const DOUBLE_NOTE_BONUS = 150;

function clampStability(state, next) {
  const floor = state.rogue.stabFloor || 0;
  return Math.max(floor, Math.min(100, next));
}

// 對應 applyStabilityDelta(1582 行)。純狀態轉移,不排 setTimeout。
//
// 注意呼叫順序:原始碼是 `setStability((s) => { ...算 next...;
// if (該觸發嚴重失衡) triggerSevereImbalance(); return next; })`——
// triggerSevereImbalance() 在 updater 內部被同步呼叫,發生在「next 這個新
// 穩定值真正生效」之前,所以 severeImbalance 的副作用(vibrate/狀態轉移)
// 要先於 onStabilityChange 通知,不能反過來,否則會跟原始碼的實際執行
// 順序不一致(這個順序問題是靠 legacyReferenceModel.js 的 parity 測試抓出來的)。
// 另外:原始碼的 setStability(fn) 不管算出來的 next 是否跟現在值一樣都會
// 呼叫,這裡故意不加「值沒變就不通知」的最佳化(那個最佳化其實是行為改變,
// 也是靠 parity 測試抓出來的)。
function applyStabilityDelta(state, delta, source, nowMs, cb) {
  if (state.practice && delta < 0) return;
  if (delta < 0 && source === "miss" && nowMs < state.imbalanceUntil) return;
  const next = clampStability(state, state.stability + delta);
  state.stability = next;
  if (next <= 0 && source === "miss" && !state.penaltyLock) {
    triggerSevereImbalance(state, nowMs, cb);
  }
  cb.onStabilityChange && cb.onStabilityChange(next, delta, source);
}

// 對應 triggerSevereImbalance(1597 行)。只做狀態轉移+通知,2 秒後的恢復
// 交給呼叫端排 setTimeout,到期呼叫 recoverFromImbalance()。
function triggerSevereImbalance(state, nowMs, cb) {
  state.penaltyLock = true;
  state.imbalanceUntil = nowMs + 2000;
  state.imbalanceKind = "severe";
  cb.onVibrate && cb.onVibrate([120, 60, 120, 60, 180]);
  cb.onSevereImbalanceTriggered && cb.onSevereImbalanceTriggered(nowMs + 2000);
}

/** 呼叫端的 setTimeout(2000ms) 到期時呼叫這個,對應原本 setTimeout 內容。 */
export function recoverFromImbalance(state, cb) {
  const next = Math.min(100, state.stability + 20);
  state.stability = next;
  state.penaltyLock = false;
  state.imbalanceKind = "";
  cb.onStabilityChange && cb.onStabilityChange(next, 20, "imbalance-recover");
}

// 對應 registerHit(1656-1724 行)。isChartNote 只影響 fullComboMiss 計數。
function registerHit(state, lane, category, isChartNote, nowMs, cb) {
  cb.onPlayDrum && cb.onPlayDrum(lane, category);
  if (category === "perfect") cb.onVibrate && cb.onVibrate(15);
  else if (category === "great") cb.onVibrate && cb.onVibrate(10);
  else if (category === "good") cb.onVibrate && cb.onVibrate(8);
  else cb.onVibrate && cb.onVibrate([25, 40, 25]);

  state.counts[category] += 1;
  cb.onCountIncrement && cb.onCountIncrement(category, state.counts[category]);

  if (category === "miss") {
    if (nowMs < state.buffMissImmuneUntil) {
      cb.onLaneFlash && cb.onLaneFlash(lane, "great");
      cb.onFloater && cb.onFloater(lane, "SAVED", "#7CFFB0");
      return { category, savedByBuff: true };
    }
    if (isChartNote) state.fullComboMiss += 1;
    cb.onStaffMissDuring && cb.onStaffMissDuring();
    state.combo = 0;
    state.comboMilestone = 0;
    state.visualMilestone = 0;
    state.perfectStreak = 0;
    state.greatPlusStreak = 0;
    cb.onComboChange && cb.onComboChange(0);
    cb.onStreaksChanged && cb.onStreaksChanged(0, 0);
    applyStabilityDelta(state, -6 * state.rogue.missMult - (state.rogue.missStabExtra || 0), "miss", nowMs, cb);
    cb.onLaneFlash && cb.onLaneFlash(lane, "miss");
    cb.onFloater && cb.onFloater(lane, JUDGE_LABEL.miss, "#FF2222");
    return { category };
  }

  if (category === "perfect") { state.perfectStreak += 1; state.greatPlusStreak += 1; }
  else if (category === "great") { state.perfectStreak = 0; state.greatPlusStreak += 1; }
  else { state.perfectStreak = 0; state.greatPlusStreak = 0; }
  cb.onStreaksChanged && cb.onStreaksChanged(state.perfectStreak, state.greatPlusStreak);

  const nextCombo = state.combo + 1;
  state.combo = nextCombo;
  state.maxCombo = Math.max(state.maxCombo, nextCombo);
  cb.onComboChange && cb.onComboChange(nextCombo);

  const mult = multiplierFor(nextCombo);
  const base = BASE_SCORE[category];
  const rg = state.rogue;
  const scoreDelta = Math.round(base * mult * rg.scoreMult * (category === "perfect" ? rg.perfMult : 1))
    + (category === "perfect" ? (rg.perfectBonus || 0) : 0);
  state.score += scoreDelta;
  cb.onScoreDelta && cb.onScoreDelta(scoreDelta);

  for (const m of COMBO_SCORE_MILESTONES) {
    if (nextCombo >= m && state.comboMilestone < m) {
      state.comboMilestone = m;
      cb.onPlayComboFanfare && cb.onPlayComboFanfare();
      break;
    }
  }
  for (const vm of VISUAL_MILESTONES) {
    if (nextCombo >= vm && state.visualMilestone < vm) {
      state.visualMilestone = vm;
      cb.onComboMilestoneFx && cb.onComboMilestoneFx(vm);
      break;
    }
  }

  if (category === "perfect") applyStabilityDelta(state, 1.5, undefined, nowMs, cb);
  if (category === "perfect" && rg.comboRecover && (nowMs - state.comboHealAt) >= 3000) {
    applyStabilityDelta(state, 1, undefined, nowMs, cb);
    state.comboHealAt = nowMs;
  }
  if (category === "great") applyStabilityDelta(state, 1, undefined, nowMs, cb);
  if (category === "good") applyStabilityDelta(state, -1, undefined, nowMs, cb);

  cb.onExpressCharge && cb.onExpressCharge(category, state.combo);
  cb.onLaneFlash && cb.onLaneFlash(lane, category);
  cb.onFloater && cb.onFloater(lane, JUDGE_LABEL[category],
    category === "perfect" ? "#FFD700" : category === "great" ? "#63C2FF" : "#C0C8D0");

  return { category, scoreDelta, comboAfter: nextCombo };
}

/**
 * judgeCore —— 純判定函式。對應 judgeLane(1726-1837 行)全部分支。
 * 不可變:輸入同一組 (input, state 快照, config) 一定得到同一個結果——
 * 所有時間都由 input.nowMs / input.beatTime / input.rawBeatClock 傳入,
 * 函式內部不會呼叫 Date.now()/performance.now()。
 *
 * @param {import("./judgeLogic.interface.js").JudgeInput} input
 * @param {import("./judgeLogic.interface.js").JudgeState} state - 會被直接修改(engine 自己管理生命週期,呼叫端不用管 mutation)
 * @param {import("./judgeLogic.interface.js").JudgeCallbacks} cb
 * @returns {import("./judgeLogic.interface.js").JudgeResult}
 */
export function judgeCore(input, state, cb) {
  const { laneIdx, beatTime, rawBeatClock, nowMs, phase, notes, bombs, noise } = input;

  // 1) 失衡 lockout:1728 行
  if (nowMs < state.imbalanceUntil) {
    cb.onLaneFlash && cb.onLaneFlash(laneIdx, "miss");
    return { category: "none", noteId: null, targetKind: "locked-out" };
  }
  // 2) 「先下後上」自動 Perfect 開場鎖輸入:1740 行——注意用的是「原始」
  //    beatClock(rawBeatClock),不是扣掉校準 offset 之後的 beatTime,
  //    這是原始碼的既有行為,照抄避免製造新的時間軸落差。
  if (phase !== "boss" && state.rogue.autoPerfect && rawBeatClock < AUTO_PERFECT_WINDOW_SEC) {
    return { category: "none", noteId: null, targetKind: "auto-perfect-lock" };
  }

  // 墨鏡 buff 放大 perfect 判定窗:1742 行
  const pwin = WINDOW_PERFECT * (((state.rogue.perfWindowMult || 1) > 1 &&
    state.items.sunglasses.activeUntil > nowMs) ? state.rogue.perfWindowMult : 1);

  // 3) BOSS 分支:1743-1767 行
  if (phase === "boss") {
    const cands = notes.filter((n) => n.lane === laneIdx);
    let best = null, bd = Infinity;
    for (const c of cands) { const d = Math.abs(beatTime - c.hitTime); if (d < bd) { best = c; bd = d; } }
    if (best && bd <= WINDOW_GOOD) {
      let cat = bd <= pwin ? "perfect" : bd <= WINDOW_GREAT ? "great" : "good";
      if (cat === "good" && nowMs < state.buffGoodToPerfectUntil) cat = "perfect";
      cb.onNoteConsumed && cb.onNoteConsumed(best.id);
      state.counts[cat] += 1;
      cb.onCountIncrement && cb.onCountIncrement(cat, state.counts[cat]);
      cb.onPlayDrum && cb.onPlayDrum(laneIdx, cat);
      cb.onLaneFlash && cb.onLaneFlash(laneIdx, cat);
      cb.onFloater && cb.onFloater(laneIdx, JUDGE_LABEL[cat],
        cat === "perfect" ? "#FFD700" : cat === "great" ? "#63C2FF" : "#C0C8D0");
      cb.onBossHit && cb.onBossHit(cat);
      const bmult = state.bossCombo >= 20 ? 1.5 : state.bossCombo >= 10 ? 1.2 : 1;
      const bbase = BASE_SCORE[cat];
      const scoreDelta = Math.round(bbase * bmult * (state.rogue.scoreMult || 1)) +
        (cat === "perfect" ? (state.rogue.perfectBonus || 0) : 0);
      state.score += scoreDelta;
      cb.onScoreDelta && cb.onScoreDelta(scoreDelta);
      cb.onExpressCharge && cb.onExpressCharge(cat, state.bossCombo);
      return { category: cat, noteId: best.id, targetKind: "boss-note", scoreDelta };
    }
    cb.onPlayDrum && cb.onPlayDrum(laneIdx, "good");
    cb.onLaneBurst && cb.onLaneBurst(laneIdx);
    return { category: "none", noteId: null, targetKind: null };
  }

  if (phase !== "running") return { category: "none", noteId: null, targetKind: null };
  const t = beatTime;

  // 4) 雙軌行李箱音符:1770-1792 行
  const doubleN = notes.find((n) => n.kind === "double" &&
    (n.lane === laneIdx || n.doubleLane === laneIdx) && Math.abs(t - n.hitTime) <= WINDOW_GOOD);
  if (doubleN) {
    const p = state.doubleNotePending[doubleN.id] || {};
    p[laneIdx] = nowMs;
    state.doubleNotePending[doubleN.id] = p;
    const otherLane = laneIdx === doubleN.lane ? doubleN.doubleLane : doubleN.lane;
    if (p[otherLane] && Math.abs(p[laneIdx] - p[otherLane]) <= DOUBLE_NOTE_SIMUL_MS) {
      const diff = Math.abs(t - doubleN.hitTime);
      let cat = diff <= pwin ? "perfect" : diff <= WINDOW_GREAT ? "great" : "good";
      if (cat === "good" && nowMs < state.buffGoodToPerfectUntil) cat = "perfect";
      cb.onNoteConsumed && cb.onNoteConsumed(doubleN.id);
      delete state.doubleNotePending[doubleN.id];
      registerHit(state, doubleN.lane, cat, true, nowMs, cb);
      registerHit(state, doubleN.doubleLane, cat, true, nowMs, cb);
      state.score += DOUBLE_NOTE_BONUS;
      cb.onScoreDelta && cb.onScoreDelta(DOUBLE_NOTE_BONUS);
      cb.onFloater && cb.onFloater(doubleN.lane, "🧳 DOUBLE!", "#FFD43B");
      cb.onDoubleNoteHit && cb.onDoubleNoteHit();
      return { category: cat, noteId: doubleN.id, targetKind: "double" };
    }
    cb.onLaneFlash && cb.onLaneFlash(laneIdx, "great");
    return { category: "none", noteId: null, targetKind: "double-pending" };
  }

  // 5) 誤觸炸彈:1793-1807 行
  const bomb = bombs.find((b) => b.lane === laneIdx && Math.abs(t - b.hitTime) <= WINDOW_GOOD);
  if (bomb) {
    cb.onBombConsumed && cb.onBombConsumed(bomb.id);
    state.combo = 0;
    state.comboMilestone = 0;
    state.visualMilestone = 0;
    state.perfectStreak = 0;
    state.greatPlusStreak = 0;
    cb.onComboChange && cb.onComboChange(0);
    cb.onStreaksChanged && cb.onStreaksChanged(0, 0);
    applyStabilityDelta(state, -8, undefined, nowMs, cb);
    cb.onVibrate && cb.onVibrate([30, 40, 30]);
    cb.onLaneFlash && cb.onLaneFlash(laneIdx, "miss");
    cb.onFloater && cb.onFloater(laneIdx, "✕炸彈", "#FF3B3B");
    return { category: "miss", noteId: bomb.id, targetKind: "bomb" };
  }

  // 6) 一般音符:1808-1821 行
  const candidates = notes.filter((n) => n.lane === laneIdx);
  let best = null, bestDiff = Infinity;
  for (const c of candidates) { const d = Math.abs(t - c.hitTime); if (d < bestDiff) { best = c; bestDiff = d; } }
  if (best && bestDiff <= WINDOW_GOOD) {
    let category = bestDiff <= pwin ? "perfect" : bestDiff <= WINDOW_GREAT ? "great" : "good";
    if (category === "good" && nowMs < state.buffGoodToPerfectUntil) category = "perfect";
    cb.onNoteConsumed && cb.onNoteConsumed(best.id);
    const r = registerHit(state, laneIdx, category, true, nowMs, cb);
    return { category: r.category, noteId: best.id, targetKind: "note", scoreDelta: r.scoreDelta };
  }

  // 7) 雜訊符號:1822-1833 行
  const nz = noise.find((n) => n.lane === laneIdx && Math.abs(t - n.hitTime) <= WINDOW_GOOD);
  if (nz) {
    cb.onNoiseConsumed && cb.onNoiseConsumed(nz.id);
    cb.onPlayDrum && cb.onPlayDrum(laneIdx, "good");
    cb.onVibrate && cb.onVibrate(8);
    cb.onLaneFlash && cb.onLaneFlash(laneIdx, "great");
    state.score += NOISE_SCORE;
    cb.onScoreDelta && cb.onScoreDelta(NOISE_SCORE);
    cb.onFloater && cb.onFloater(laneIdx, "+" + NOISE_SCORE, "#94D8FF");
    return { category: "none", noteId: nz.id, targetKind: "noise", scoreDelta: NOISE_SCORE };
  }

  // 8) 完全空軌:1834-1836 行
  cb.onPlayDrum && cb.onPlayDrum(laneIdx, "good");
  cb.onLaneBurst && cb.onLaneBurst(laneIdx);
  return { category: "none", noteId: null, targetKind: null };
}

/**
 * GameEngine —— 持有「引擎自己的」判定狀態(不是 React state)的薄殼,
 * 內部呼叫上面的純函式 judgeCore/applyStabilityDelta 等。
 * React(或未來的 Native 實作)只需要:
 *   const engine = createGameEngine(callbacks);
 *   engine.hit({ laneIdx, beatTime, rawBeatClock, nowMs, phase, notes, bombs, noise });
 * 然後在傳進去的 callbacks 裡呼叫對應的 setState/播音效/震動 API。
 */
export function createGameEngine(callbacks = {}) {
  let state = createInitialJudgeState();
  return {
    hit(input) { return judgeCore(input, state, callbacks); },
    recoverFromImbalance(nowMs) { return recoverFromImbalance(state, callbacks); },
    setRogue(rogue) { state.rogue = { ...state.rogue, ...rogue }; },
    setItems(items) { state.items = { ...state.items, ...items }; },
    setPractice(v) { state.practice = !!v; },
    setBuffMissImmuneUntil(t) { state.buffMissImmuneUntil = t; },
    setBuffGoodToPerfectUntil(t) { state.buffGoodToPerfectUntil = t; },
    setBossCombo(v) { state.bossCombo = v; },
    getState() { return state; },
    loadState(s) { state = { ...createInitialJudgeState(), ...s }; },
    reset() { state = createInitialJudgeState(); },
  };
}
