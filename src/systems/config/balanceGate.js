// balanceGate —— 「平衡對抗」共用純物理(逐字對照原始碼 `advanceBalance`,
// 分散在 2039-2058/2284-2309/3329-3337 三處呼叫端:BOSS 50%/30% 血量門檻
// 平衡對抗、背包客擠過來事件、一般行駛間的曲道平衡對抗,三者用的是**同一套
// 慣性物理**,只有 needMs/勝負門檻/獎懲數值不同)。這裡拆出來當共用模組,
// 放在 `config/` 是因為 `BAL_*` 常數本來就已經在 `constants.js`——跟
// `effect/shake.js` 的衰減模型被 Camera/Boss 共用是同樣的「基礎物理抽出來
// 大家一起用」精神,不是重新設計新公式。
//
// 純數學,不碰 DOM/React:同一組 (state, tickMs, 輸入) 一定算出同一個結果,
// 呼叫端自己決定要不要每 50ms tick 一次(逐字對照原始碼的 tick 頻率)。
import { BAL_PUSH, BAL_COUNTER, BAL_DEADZONE, BAL_CLAMP } from "./constants.js";

// createBalanceGate:建立一次平衡對抗的初始狀態。
// - push:玩家要抵抗的甩動方向("left"/"right"/"forward"/"backward")。
// - needMs:「維持在平衡區間」總共要累積多久才算成功。
// - now/burstMs:對照 BOSS gate 的 650ms「衝擊擊退」前搖,這段時間內
//   `advanceBalanceGate` 會直接跳過(凍結),不計入 push/counter,純粹是
//   給呼叫端播擊退動畫用的緩衝。一般平衡事件沒有前搖,burstMs 傳 0 即可。
// - clashMs:前搖結束後,玩家實際有多久時間可以完成 needMs 的累積
//   (deadline = now + burstMs + clashMs)。
export function createBalanceGate({ push, needMs, now = 0, burstMs = 0, clashMs }) {
  return {
    push, pos: 0, needMs, heldMs: 0,
    burstUntil: now + burstMs,
    deadline: now + burstMs + clashMs,
  };
}

export function isInBalance(pos) {
  return Math.abs(pos) <= BAL_DEADZONE;
}

// advanceBalanceGate:推進一個 tick(預設對照原始碼的 50ms 一格)。
// - counterActive:玩家是否正在往 push 的反方向抵抗(傾斜/長按方向鍵)。
// - wrongActive:玩家是否往跟 push 同方向使力(原始碼的「抵抗抵抗方向抓
//   錯」情境,會讓推力加倍,不是單純沒抵抗而已)。
// burst 前搖期間直接原樣返回(凍結),對照原始碼「burstUntil 之前 tick 提前
// return」的行為。
export function advanceBalanceGate(gate, { counterActive = false, wrongActive = false } = {}, now, tickMs = 50) {
  if (now != null && now < gate.burstUntil) return gate;
  const steps = tickMs / 50;
  const push = BAL_PUSH * steps + (wrongActive ? BAL_PUSH * steps : 0);
  const counter = counterActive ? BAL_COUNTER * steps : 0;
  const pos = Math.max(-BAL_CLAMP, Math.min(BAL_CLAMP, gate.pos + push - counter));
  gate.pos = pos;
  if (isInBalance(pos)) gate.heldMs += tickMs;
  return gate;
}

// resolveBalanceGate:算目前的達成比例 pct(0~1)跟是否達到門檻,呼叫端
// 在 `now >= gate.deadline` 時呼叫來判定這次平衡對抗的成敗。`thresholdPct`
// 對照 BOSS gate 用 0.3(對照原始碼 30% 即算數,比一般平衡事件的門檻低)、
// 一般平衡事件/背包客事件用 1(要完整撐滿 needMs 才算完全成功)。
export function resolveBalanceGate(gate, thresholdPct = 1) {
  const pct = Math.max(0, Math.min(1, gate.heldMs / gate.needMs));
  return { pct, met: pct >= thresholdPct };
}
