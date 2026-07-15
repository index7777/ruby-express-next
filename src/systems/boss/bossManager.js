// BossManager —— 逐字對照原始碼 BOSS 戰核心邏輯搬過來的狀態機(散落在
// `web-build/index.html` 2039-2178(tick 判斷)/3180-3474(命中/彈幕/特招/
// finisher/死亡復活)七大段,這裡整理成一個獨立、不碰 DOM/React 的類別,
// 純函式輸入輸出,方便 node 測試腳本直接驗證數值,不用真的跑一場 BOSS 戰)。
//
// Contract(跟 `judge/gameEngine.js` 的 Contract 精神一致):同一組 (state,
// 輸入, now) 一定得到同一個結果,內部不偷偷呼叫 `Date.now()`,亂數一律
// 透過參數注入的 `rand`(預設 `Math.random`)取代,方便測試用固定序列
// 重現同一場戰鬥。
import {
  DMG_TABLE, SELF_DMG_TABLE, BOSS_HP, PLAYER_HP, BOSS_DMG_PER_HIT, BOSS_SELF_DMG,
  BOSS_FINISHER_HP, BOSS_FINISHER_SUCCESS_SCORE, BOSS_FINISHER_FAIL_SCORE, BOSS_FINISHER_FAIL_DMG_PCT,
  BOSS_BULLET_INTERVAL_MS, BOSS_SPECIAL_INTERVAL_MS, HOLD_NEED_MS, HOLD_EXTRA_WINDOW_MS,
  APPROACH_SEC, LANES,
} from "../config/index.js";
import { createBalanceGate, advanceBalanceGate, resolveBalanceGate } from "../config/balanceGate.js";

const LANE_COUNT = LANES.length;

function defaultRand() { return Math.random(); }

// bhp → bphase,逐字對照原始碼 2127 行的三段門檻。
export function phaseForHp(hp) {
  return hp <= 30 ? 3 : hp <= 50 ? 2 : 1;
}

export class BossManager {
  constructor(maxPlayerHp = PLAYER_HP) {
    this.maxPlayerHp = maxPlayerHp;
    this.reset();
  }

  reset() {
    this.hp = BOSS_HP;
    this.phase = 1;
    this.gates = { g50: false, g30: false };
    this.finisherLocked = false;
    this.hold = null;
    this.gate = null;
    this.outcome = null; // null | "win" | "lose"
    this.playerHp = this.maxPlayerHp;
    this.playerInvincibleUntil = 0;
    this.reviveUsed = false;
    this.eventStats = { g50: null, g30: null, finisher: null };
  }

  // ── 命中判定(對照 bossApplyHit,3180-3219 行)──
  // opts: { combo=0(combo 倍率門檻)、rageMult=1(道具/rogue 卡加成)、
  // rogueDmgMult=1、selfDmgActive=true(false 代表玩家有護盾/無敵,自傷歸零)}
  applyHit(category, opts = {}) {
    const { combo = 0, rageMult = 1, rogueDmgMult = 1, selfDmgActive = true } = opts;
    const dm = combo >= 20 ? 1.5 : combo >= 10 ? 1.2 : 1;
    const bossDmg = (DMG_TABLE[category] ?? 0) * BOSS_DMG_PER_HIT * dm * rageMult * rogueDmgMult;
    const selfDmg = selfDmgActive ? (SELF_DMG_TABLE[category] ?? 0) * BOSS_SELF_DMG : 0;

    let finisherTriggered = false;
    if (this.finisherLocked) {
      // 鎖血期間,傷害幾乎打不動 HP(對照 3204 行 hp = max(FINISHER_HP, hp - dmg*0.001))。
      this.hp = Math.max(BOSS_FINISHER_HP, this.hp - bossDmg * 0.001);
    } else {
      const nextHp = Math.max(0, this.hp - bossDmg);
      if (nextHp <= BOSS_FINISHER_HP && !this.hold && !this.gate) {
        this.hp = BOSS_FINISHER_HP;
        this.finisherLocked = true;
        finisherTriggered = true;
      } else {
        this.hp = nextHp;
      }
    }

    this.playerHp = Math.max(0, this.playerHp - selfDmg);

    return { bossDmg, selfDmg, hp: this.hp, playerHp: this.playerHp, finisherTriggered };
  }

  // ── 階段門檻檢查(對照 tick 迴圈 2123-2178 行)── 每次命中後或定期呼叫,
  // 回傳這次是否觸發 g50/g30 平衡對抗閘門(呼叫端收到非 null 就該接著呼叫
  // `startGate()` 啟動平衡對抗小遊戲,並清空盤面彈幕)。
  checkPhaseGate() {
    const bhp = this.hp;
    this.phase = phaseForHp(bhp);
    if (!this.gates.g50 && bhp <= 50) {
      this.gates.g50 = true;
      return "g50";
    }
    if (!this.gates.g30 && bhp <= 30) {
      this.gates.g30 = true;
      return "g30";
    }
    return null;
  }

  bulletIntervalMs() { return BOSS_BULLET_INTERVAL_MS[this.phase]; }
  specialIntervalMs() { return BOSS_SPECIAL_INTERVAL_MS[this.phase]; }

  // ── 備援固定間隔彈幕生成(對照 spawnBossWave,3235-3269 行)── isLaneFree
  // 是呼叫端提供的「這個軌道現在能不能生」判斷(避免跟盤面既有音符衝堆疊),
  // 預設一律視為可生(純函式測試場景不需要真的接盤面)。slowActive 對照
  // 墨鏡道具生效時彈幕下降變慢(APPROACH_SEC*1.7)。
  spawnWave(now, { isLaneFree = () => true, slowActive = false, rand = defaultRand } = {}) {
    const appr = slowActive ? APPROACH_SEC * 1.7 : APPROACH_SEC;
    const pickFreeLane = (excluded = []) => {
      const candidates = [];
      for (let i = 0; i < LANE_COUNT; i++) {
        if (!excluded.includes(i) && isLaneFree(i)) candidates.push(i);
      }
      if (candidates.length === 0) return null;
      return candidates[Math.floor(rand() * candidates.length) % candidates.length];
    };
    const mk = (lane, delay) => ({ lane, delay, hitTime: now + appr + delay, fallSec: appr });

    if (this.phase === 1) {
      const lane = pickFreeLane();
      return lane == null ? [] : [mk(lane, 0)];
    }
    if (this.phase === 2) {
      const roll = rand();
      if (roll < 0.45) {
        const a = pickFreeLane();
        const b = a == null ? null : pickFreeLane([a]);
        if (a == null) return [];
        return b == null ? [mk(a, 0)] : [mk(a, 0), mk(b, 0)];
      }
      const lane = pickFreeLane();
      return lane == null ? [] : [mk(lane, 0)];
    }
    // phase 3
    const roll = rand();
    if (roll < 0.35) {
      const dir = rand() < 0.5 ? 1 : -1;
      const start = dir === 1 ? 0 : LANE_COUNT - 1;
      const out = [];
      for (let k = 0; k < 3; k++) {
        const lane = start + dir * k;
        if (lane >= 0 && lane < LANE_COUNT) out.push(mk(lane, k * 0.12));
      }
      return out;
    }
    if (roll < 0.7) {
      const a = pickFreeLane();
      const b = a == null ? null : pickFreeLane([a]);
      if (a == null) return [];
      return b == null ? [mk(a, 0)] : [mk(a, 0), mk(b, 0)];
    }
    const lane = pickFreeLane();
    return lane == null ? [] : [mk(lane, 0)];
  }

  // ── 特殊招式(對照 bossSpecial,3320-3327 行)── P1 只有 signal,P2/P3
  // signal/spit 各半機率。回傳招式名稱,實際彈幕由 `specialMoveBullets()`
  // 另外算(拆開是因為兩者職責不同:選招 vs 算彈幕位置)。
  rollSpecialMove(rand = defaultRand) {
    const pool = this.phase === 1 ? ["signal"] : ["signal", "spit"];
    return pool[Math.floor(rand() * pool.length) % pool.length];
  }

  // ── chart 驅動模式的額外插音符機率(對照 2139 行)── P1 不會插,P2/P3
  // 各自的機率/延遲不同。呼叫端(chart 消耗迴圈)在生出一顆 chart 音符後
  // 呼叫這個,拿到非 null 結果就在「另一個隨機軌道」多生一顆(要選哪個
  // 軌道由呼叫端決定,這裡只負責機率/延遲判斷)。
  rollExtraChartNote(rand = defaultRand) {
    if (this.phase === 1) return null;
    const chance = this.phase === 3 ? 0.5 : 0.3;
    if (rand() >= chance) return null;
    return { delaySec: this.phase === 3 ? 0.08 : 0.05 };
  }

  // ── 特殊招式對應的彈幕(對照 signalAttack/spitAttack,3277-3298 行)──
  // signal:洗牌後每軌各生一顆,保證不同軌(避免同軌疊到打不完);
  // spit:2 顆隨機軌道,固定延遲 0.1s / 0.5s。`slowActive` 對照墨鏡道具生效
  // 時彈幕下降變慢,跟 `spawnWave()` 共用同一個 1.7 倍係數,2026-07-15s
  // 補上(先前只有 `spawnWave()` 接了這個參數,特招彈幕漏接)。
  specialMoveBullets(move, now, { rand = defaultRand, slowActive = false } = {}) {
    const appr = slowActive ? APPROACH_SEC * 1.7 : APPROACH_SEC;
    if (move === "signal") {
      const n = this.phase === 3 ? 5 : 4;
      const lanes = Array.from({ length: LANE_COUNT }, (_, i) => i);
      for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
      }
      return lanes.slice(0, n).map((lane, k) => ({ lane, delay: k * 0.16, hitTime: now + appr + k * 0.16, fallSec: appr }));
    }
    // spit
    const a = Math.floor(rand() * LANE_COUNT);
    const b = Math.floor(rand() * LANE_COUNT);
    return [
      { lane: a, delay: 0.1, hitTime: now + appr + 0.1, fallSec: appr },
      { lane: b, delay: 0.5, hitTime: now + appr + 0.5, fallSec: appr },
    ];
  }

  // ── 長按 QTE(對照 holdAttack,3301-3313 行)── isFinisher=true 是
  // `triggerBossFinisher()` 呼叫的死前最後一擊,need 依階段拉長。
  startHoldAttack(now, isFinisher, { rand = defaultRand } = {}) {
    const lane = Math.floor(rand() * LANE_COUNT);
    const need = HOLD_NEED_MS[this.phase];
    this.hold = { lane, need, held: 0, deadline: now + need + HOLD_EXTRA_WINDOW_MS, isFinisher };
    return this.hold;
  }

  // 每個 tick 呼叫,isHeld = 玩家這一刻是否按著指定軌道。
  tickHold(deltaMs, isHeld) {
    if (!this.hold || !isHeld) return this.hold;
    this.hold.held = Math.min(this.hold.need, this.hold.held + deltaMs);
    return this.hold;
  }

  // ── QTE 判定(對照 2062-2111 行)── now >= deadline 才會有結果,否則回 null。
  resolveHold(now, { invincible = false } = {}) {
    if (!this.hold || now < this.hold.deadline) return null;
    const { held, need, isFinisher } = this.hold;
    const heldPct = Math.min(1, held / need);
    let success = heldPct >= 1;
    let scoreDelta = 0, damage = 0;

    if (success) {
      scoreDelta = BOSS_FINISHER_SUCCESS_SCORE;
      if (isFinisher) {
        this.finisherLocked = false;
        this.hp = 0; // 觸發真正的死亡判定(見 checkDeath())
      }
    } else {
      scoreDelta = -BOSS_FINISHER_FAIL_SCORE;
      if (!invincible) {
        damage = this.maxPlayerHp * BOSS_FINISHER_FAIL_DMG_PCT;
        this.playerHp = Math.max(0, this.playerHp - damage);
      }
      // 失敗但玩家沒死:finisherLocked 保持 true,HP 還是釘在 FINISHER_HP,
      // 下一次命中會再次觸發 finisher QTE(對照原始碼「無限重試直到成功或死亡」)。
    }

    if (isFinisher) this.eventStats.finisher = { success, score: scoreDelta };
    this.hold = null;
    return { success, scoreDelta, damage, isFinisher };
  }

  // ── 平衡對抗閘門(對照 startBossGate,3329-3337 行)── key 用來記錄這次
  // 閘門結果要寫進 eventStats 的哪個欄位("g50"/"g30")。
  startGate(now, key, { rand = defaultRand, needMs = 1200, burstMs = 650, clashMs = 3000 } = {}) {
    const push = rand() < 0.5 ? "left" : "right";
    this.gate = createBalanceGate({ push, needMs, now, burstMs, clashMs });
    this.gate.key = key;
    return this.gate;
  }

  advanceGate(now, { counterActive = false, wrongActive = false } = {}) {
    if (!this.gate) return null;
    return advanceBalanceGate(this.gate, { counterActive, wrongActive }, now);
  }

  // ── 閘門判定(對照 2039-2058 行)── BOSS 閘門門檻是 30%(比一般平衡事件
  // 要求的 100% 低很多),成功回血、失敗扣血。
  resolveGate(now, { invincible = false } = {}) {
    if (!this.gate || now < this.gate.deadline) return null;
    const { pct, met } = resolveBalanceGate(this.gate, 0.3);
    let scoreDelta = 0, heal = 0, damage = 0;
    if (met) {
      heal = this.maxPlayerHp * 0.08;
      scoreDelta = Math.round(pct * 800);
      this.playerHp = Math.min(this.maxPlayerHp, this.playerHp + heal);
    } else if (!invincible) {
      const shortfall = Math.max(0, Math.min(1, 1 - pct / 0.3));
      damage = BOSS_SELF_DMG * 2 * shortfall;
      this.playerHp = Math.max(0, this.playerHp - damage);
    }
    const key = this.gate.key || (!this.gates.g30 ? "g50" : "g30");
    this.eventStats[key] = { pct: Math.round(pct * 100), score: scoreDelta };
    this.gate = null;
    return { pct, met, scoreDelta, heal, damage };
  }

  // ── 勝負判斷(對照 2169-2176 行 win / checkPlayerDeath,3222-3232 行 lose)──
  checkDeath() {
    if (this.outcome) return this.outcome;
    if (this.hp <= 0) this.outcome = "win";
    else if (this.playerHp <= 0) this.outcome = "lose";
    return this.outcome;
  }

  // ── 復活(對照 confirmRevive,3375-3410 行)── 扣 80 哩程、回滿血、3 秒無敵、
  // 若復活時 finisher 還鎖著,重新開一次 finisher QTE。
  revive(now, { points = 0, cost = 80 } = {}) {
    if (this.reviveUsed) return { ok: false, reason: "used" };
    if (points < cost) return { ok: false, reason: "points" };
    this.reviveUsed = true;
    this.playerHp = this.maxPlayerHp;
    this.playerInvincibleUntil = now + 3000;
    this.outcome = null;
    if (this.finisherLocked && !this.hold) this.startHoldAttack(now, true);
    return { ok: true, cost };
  }

  // ── 重新挑戰(對照 retryBoss,3412-3419 行)── 整場重來。
  retry() {
    this.reset();
  }
}

export function createBossManager(maxPlayerHp) {
  return new BossManager(maxPlayerHp);
}
