// 針對這次 Phase 3 接線新增的 engine.miss()(音符過期自動 miss)寫的專屬測試。
// 這條路徑不在既有 test-judge-parity.mjs 的 8 組場景範圍內(legacyReferenceModel
// 的 registerHit() 沒有單獨對外暴露,只透過 judgeLane 的 bomb/一般音符分支間接
// 呼叫),所以另外驗證 engine.miss() 的行為是否符合 registerHit(miss) 該有的效果。
import { createGameEngine } from "./src/systems/judge/gameEngine.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; } else { fail++; console.error("FAIL:", label); }
}

// 1) 基本 miss 行為:combo 歸零、counts.miss+1、stability 下降、callback 觸發
{
  const log = [];
  const engine = createGameEngine({
    onScoreDelta: (d) => log.push(["score", d]),
    onCountIncrement: (cat) => log.push(["count", cat]),
    onComboChange: (v) => log.push(["combo", v]),
    onStabilityChange: (v) => log.push(["stability", v]),
    onFloater: (l, t) => log.push(["floater", l, t]),
    onLaneFlash: (l, k) => log.push(["flash", l, k]),
  });
  // 先手動打幾顆 perfect 累積 combo
  for (let i = 0; i < 5; i++) {
    engine.hit({ laneIdx: 0, beatTime: i, rawBeatClock: i, nowMs: i * 1000, phase: "running", notes: [{ id: "n" + i, lane: 0, hitTime: i }], bombs: [], noise: [] });
  }
  const beforeCombo = engine.getState().combo;
  assert(beforeCombo === 5, "手動打 5 顆 perfect 後 combo=5(前置條件)");

  const r = engine.miss(2, true, 6000);
  const st = engine.getState();
  assert(r.category === "miss", "engine.miss() 回傳 category=miss");
  assert(st.combo === 0, "engine.miss() 後 combo 歸零,行為對齊原始碼 registerHit(miss)");
  assert(st.counts.miss === 1, "counts.miss 正確累加");
  assert(st.fullComboMiss === 1, "isChartNote=true 時 fullComboMiss 累加(占位音符 miss 才不算)");
  assert(log.some((e) => e[0] === "combo" && e[1] === 0), "onComboChange(0) 有被呼叫");
  assert(log.some((e) => e[0] === "flash" && e[1] === 2 && e[2] === "miss"), "onLaneFlash(lane, \"miss\") 有被呼叫");
}

// 2) isChartNote=false(占位行李客雙軌音符 miss)不計入 fullComboMiss,對齊
//    原始碼 index.html 2420 行 `registerHit(n.lane, "miss", n.kind !== "double")`。
{
  const engine = createGameEngine({});
  engine.miss(0, false, 1000);
  const st = engine.getState();
  assert(st.counts.miss === 1, "counts.miss 仍然累加(不論 isChartNote)");
  assert(st.fullComboMiss === 0, "isChartNote=false 時 fullComboMiss 不累加");
}

// 3) 連續 miss 觸發嚴重失衡(stability 打到 0 以下)時,onSevereImbalanceTriggered 會被呼叫,
//    且觸發當下 imbalanceUntil 之後的 engine.hit() 會被鎖住(對齊 judgeCore 第 1 段)。
{
  const events = [];
  const engine = createGameEngine({
    onSevereImbalanceTriggered: (until) => events.push(["severe", until]),
    onLaneFlash: (l, k) => events.push(["flash", l, k]),
  });
  let nowMs = 0;
  // stability 初始 100,每次 miss -6,需要打到 <=0 才觸發(向下取整大約 17 次)
  for (let i = 0; i < 17; i++) {
    engine.miss(0, true, nowMs);
    nowMs += 100;
  }
  assert(events.some((e) => e[0] === "severe"), "連續 miss 打到 stability<=0 時觸發 onSevereImbalanceTriggered");
  const lockedResult = engine.hit({ laneIdx: 1, beatTime: 0, rawBeatClock: 0, nowMs, phase: "running", notes: [{ id: "x", lane: 1, hitTime: 0 }], bombs: [], noise: [] });
  assert(lockedResult.targetKind === "locked-out", "嚴重失衡期間 engine.hit() 被鎖住(targetKind=locked-out)");

  // recoverFromImbalance 後應該解除鎖定
  engine.recoverFromImbalance(nowMs + 2000);
  const afterRecover = engine.hit({ laneIdx: 1, beatTime: 100, rawBeatClock: 100, nowMs: nowMs + 2001, phase: "running", notes: [{ id: "y", lane: 1, hitTime: 100 }], bombs: [], noise: [] });
  assert(afterRecover.targetKind !== "locked-out", "recoverFromImbalance 後解除鎖定,恢復正常判定");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
