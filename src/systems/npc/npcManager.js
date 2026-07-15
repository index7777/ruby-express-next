// NpcManager —— 逐字對照原始碼 NPC 系統核心邏輯搬過來的狀態機(散落在
// `web-build/index.html` 2248-2612 行的權重抽選/tick 生成迴圈、1611-1652
// 行的驅散規則、1780-1830 行的命中判定順序,共 10 種 NPC 型別:6 種原本
// README 就列出的負向/清場角色 + 後續加的 4 種增益角色)。
//
// Contract 跟 `boss/bossManager.js` 一致:同一組 (state, 輸入, now) 一定
// 得到同一個結果,不偷偷呼叫 `Date.now()`,亂數透過 `rand` 參數注入。
import { NPC_TYPES, BUFF_NPC_TYPES } from "../data/index.js";
import { STAFF_DURATION_MS, BACKPACK_SCORE, NOISE_SCORE, LANES } from "../config/index.js";
import { createBalanceGate } from "../config/balanceGate.js";

const LANE_COUNT = LANES.length;
function defaultRand() { return Math.random(); }
function typeDef(type) { return NPC_TYPES.find((t) => t.type === type); }

export class NpcManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = [];       // 目前在場的 NPC 實體 { id, type, bornAt, durationMs, ... }
    this._seq = 0;
    this.noise = [];        // 擴音上班族丟出的雜訊音符
    this.bombs = [];        // 亂跑小孩丟出的炸彈音符
    this.luggage = [];      // 占位行李客丟出的雙軌行李箱音符
    this.backpackStack = []; // 背包客視覺疊層(跟 NPC 實體生命週期分開)
    this.staffActive = null; // { id, endsAt, missDuring }
    this.cleanerBlockUntil = 0;
    this.noiseAttackCount = new Map(); // npcId -> 已丟出雜訊次數(phone 護盾用)
  }

  _nextId(prefix) {
    this._seq += 1;
    return `${prefix}${this._seq}`;
  }

  // ── 權重抽選(對照 2482-2503 行)── ctx: { npcWeight, npcCap, stability,
  // rogueNpcExtra=0, songRemainingSec=Infinity, trainBalanceActive=false }。
  // 回傳選中的 type 字串,或 null(這次沒抽中/沒有符合條件的候選)。
  rollSpawn(now, ctx = {}, rand = defaultRand) {
    const {
      npcWeight = 1, npcCap = 2, stability = 100, rogueNpcExtra = 0,
      songRemainingSec = Infinity, trainBalanceActive = false,
    } = ctx;
    if (this.staffActive) return null; // 站務員在場時完全不抽新 NPC

    const cap = Math.min(npcCap + (stability < 30 ? 1 : 0) + rogueNpcExtra, NPC_TYPES.length);
    if (this.active.length >= cap) return null;

    const chance = 0.15 * npcWeight * (stability < 30 ? 2 : 1);
    if (rand() >= chance) return null;

    const activeTypes = new Set(this.active.map((n) => n.type));
    const hasBuffActive = this.active.some((n) => BUFF_NPC_TYPES.includes(n.type));
    const hasStudentSeat = activeTypes.has("student_seat");

    const pool = NPC_TYPES.filter((t) => {
      if (activeTypes.has(t.type)) return false;
      if (hasBuffActive && BUFF_NPC_TYPES.includes(t.type)) return false;
      if (t.type === "backpack" && (trainBalanceActive || hasStudentSeat)) return false;
      if (t.durationMs > songRemainingSec * 1000) return false;
      return true;
    });
    if (pool.length === 0) return null;

    const totalWeight = pool.reduce((s, t) => s + t.weight, 0);
    let r = rand() * totalWeight;
    for (const t of pool) {
      r -= t.weight;
      if (r <= 0) return t.type;
    }
    return pool[pool.length - 1].type;
  }

  // ── 生成一個 NPC 實體(對照各型別的 on-pick 初始化)── 站務員上場會把
  // 其他在場 NPC 實體換掉(對照 2508-2539 行「清場」,只換 NPC 陣列本身,
  // 不動盤面已經丟出的雜訊/炸彈/行李箱音符——這是原始碼修過的 bug,清潔
  // 隊員才是清盤面 hazard 的角色,見 `resolveCleanerPick`)。
  spawn(type, now, { rand = defaultRand } = {}) {
    const def = typeDef(type);
    if (!def) throw new Error(`NpcManager.spawn: 未知的 NPC type "${type}"`);
    const id = this._nextId("npc");
    const npc = { id, type, bornAt: now, durationMs: def.durationMs, lastEventAt: now };

    if (type === "staff") {
      this.active = []; // 站務員登場:換掉其他 NPC 實體,不動 hazard 陣列
      this.staffActive = { id, endsAt: now + def.durationMs, missDuring: false };
    }
    if (type === "luggage") {
      npc.remainSpawn = 1 + Math.floor(rand() * 3); // 1~3 顆
      npc.phase2 = false;
    }
    if (type === "cleaner") {
      // 瞬清負面(對照 2566-2571 行):清掉盤面雜訊/炸彈,3 秒內阻擋新負面。
      this.noise = [];
      this.bombs = [];
      this.backpackStack = [];
      this.cleanerBlockUntil = now + def.durationMs;
    }

    this.active.push(npc);
    let gateRequest = null;
    if (type === "backpack") {
      // 背包客一上場觸發一次性平衡對抗(擠過來),對照 2545-2559 行:
      // needMs:900、clashMs:2600,跟共用的 balanceGate 物理接軌。
      gateRequest = createBalanceGate({
        push: rand() < 0.5 ? "left" : "right",
        needMs: 900, now, burstMs: 0, clashMs: 2600,
      });
      this.backpackStack.push({ id: this._nextId("bag"), bornAt: now });
    }
    return { npc, gateRequest };
  }

  // ── 每 tick 呼叫一次(對照 2248-2612 行的各個 timer 迴圈)── 回傳這一刻
  // 該生成的雜訊/炸彈/行李箱雙軌音符請求,以及已到期該移除的 NPC id。
  // isLaneFree(lane) 由呼叫端注入(避免跟盤面既有音符衝堆疊),預設一律
  // 視為空閒。
  tick(now, { isLaneFree = () => true, rand = defaultRand } = {}) {
    const noiseSpawns = [], bombSpawns = [], luggageSpawns = [];
    const expired = [];
    const cleanerBlocking = now < this.cleanerBlockUntil;

    for (const npc of this.active) {
      const age = now - npc.bornAt;
      if (npc.type === "phone" && !cleanerBlocking && now - npc.lastEventAt >= 950) {
        npc.lastEventAt = now;
        const n = rand() < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const lane = this._pickFreeLane(isLaneFree, rand);
          if (lane != null) {
            // 注意:這裡刻意不算 hitTime——NpcManager 全部用「呼叫端傳入的
            // now」這個單一時間軸(ms,對照 durationMs/interval 這些欄位),
            // 不知道呼叫端的譜面/下落動畫是用秒數的 beatClock 算 hitTime
            // (對照 boss/bossManager.js 的 spawnWave 也是同樣的雙時間軸
            // 情境:APPROACH_SEC 是秒,是呼叫端自己的判定/渲染時間軸的事,
            // 呼叫端收到 { id, lane } 後自己用 `t + APPROACH_SEC` 算 hitTime,
            // 塞進要餵給 judgeCore 的 noise/bombs 陣列)。
            noiseSpawns.push({ id: this._nextId("noise"), lane });
            this.noiseAttackCount.set(npc.id, (this.noiseAttackCount.get(npc.id) || 0) + 1);
          }
        }
      }
      if (npc.type === "kid" && !cleanerBlocking && now - npc.lastEventAt >= 850) {
        npc.lastEventAt = now;
        const lane = this._pickFreeLane(isLaneFree, rand);
        if (lane != null) bombSpawns.push({ id: this._nextId("bomb"), lane });
      }
      if (npc.type === "luggage" && npc.remainSpawn > 0 && now - npc.lastEventAt >= 1200) {
        npc.lastEventAt = now;
        const pairStart = Math.floor(rand() * (LANE_COUNT - 1));
        luggageSpawns.push({ id: this._nextId("luggage"), pairStart, kind: "double" });
        npc.remainSpawn -= 1;
        if (npc.remainSpawn <= 0) npc.phase2 = true;
      }
      if (age >= npc.durationMs) expired.push(npc.id);
    }

    // 站務員到期結算(對照 2444-2458 行)。站務員實體本身的到期已經由上面
    // 那個通用的 `age >= durationMs` 迴圈判斷過、加進 `expired` 了(staff
    // 的 durationMs 跟 endsAt-bornAt 是同一件事),這裡只需要另外算「巡查
    // 有沒有零 miss」的獎懲結果。
    let staffResult = null;
    if (this.staffActive && now >= this.staffActive.endsAt) {
      staffResult = { success: !this.staffActive.missDuring };
      this.staffActive = null;
    }

    if (expired.length) {
      for (const id of expired) this.noiseAttackCount.delete(id);
      this.active = this.active.filter((n) => !expired.includes(n.id));
    }

    return { noiseSpawns, bombSpawns, luggageSpawns, expiredNpcs: expired, staffResult };
  }

  _pickFreeLane(isLaneFree, rand) {
    const candidates = [];
    for (let i = 0; i < LANE_COUNT; i++) if (isLaneFree(i)) candidates.push(i);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rand() * candidates.length) % candidates.length];
  }

  // 站務員巡查期間任何一次 miss 都要呼叫這個(對照 1672 行)。
  reportMiss() {
    if (this.staffActive) this.staffActive.missDuring = true;
  }

  // ── 驅散規則(對照 maybeDismissNpc,1611-1652 行)── 回傳能不能驅散,
  // 呼叫端自己決定要不要真的呼叫 `dismiss()`。
  canDismiss(type, npcId, now, info = {}) {
    if (type === "phone") {
      const npc = this.active.find((n) => n.id === npcId);
      if (!npc) return false;
      const elapsedMs = now - npc.bornAt;
      const noiseCount = this.noiseAttackCount.get(npcId) || 0;
      return (info.greatPlusStreak || 0) >= 2 && elapsedMs >= 1500 && noiseCount >= 2;
    }
    if (type === "kid") return (info.perfectStreak || 0) >= 4;
    return false;
  }

  dismiss(npcId) {
    const npc = this.active.find((n) => n.id === npcId);
    this.active = this.active.filter((n) => n.id !== npcId);
    this.noiseAttackCount.delete(npcId);
    return npc ? { type: npc.type } : null;
  }

  // 背包客視覺疊層驅散(對照 1613-1622 行,門檻比一般 NPC 驅散低:連續
  // 2 個 Perfect 就能拍掉最舊的一疊,+300 分)。跟 `dismiss()`(驅散 NPC
  // 實體本身)是兩件事——這裡拍掉的是疊層,不影響 `active` 裡的 backpack
  // 實體是否還在場。
  popBackpackStack(perfectStreak) {
    if (perfectStreak < 2 || this.backpackStack.length === 0) return null;
    this.backpackStack.shift();
    return { scoreDelta: BACKPACK_SCORE };
  }

  // ── 命中判定(對照 1780-1830 行判定順序:炸彈 > 真音符 > 雜訊/雙軌)──
  hitBomb(bombId) {
    const before = this.bombs.length;
    this.bombs = this.bombs.filter((b) => b.id !== bombId);
    return { hit: this.bombs.length < before };
  }

  hitNoise(noiseId) {
    const before = this.noise.length;
    this.noise = this.noise.filter((n) => n.id !== noiseId);
    return { hit: this.noise.length < before, scoreDelta: this.noise.length < before ? NOISE_SCORE : 0 };
  }

  // 雙軌行李箱:兩軌都要同時按到(pressedLanes 是這次輸入涵蓋的軌道陣列)。
  hitLuggageDouble(luggageId, pressedLanes) {
    const note = this.luggage.find((n) => n.id === luggageId);
    if (!note) return { hit: false };
    const need = [note.pairStart, note.pairStart + 1];
    const bothPressed = need.every((l) => pressedLanes.includes(l));
    if (!bothPressed) return { hit: false, partial: true };
    this.luggage = this.luggage.filter((n) => n.id !== luggageId);
    return { hit: true, scoreDelta: 150, double: true };
  }

  // ── 增益 NPC 的效果查詢(純函式,依 active 清單 + now 推導,不需要另外
  // 維護一堆 `xxxUntilRef`)──
  isBuffActive(type, now) {
    const npc = this.active.find((n) => n.type === type);
    if (!npc) return false;
    return now - npc.bornAt < npc.durationMs;
  }
  isPoliceActive(now) { return this.isBuffActive("police", now); }         // Good→Perfect
  isConductorActive(now) { return this.isBuffActive("conductor", now); }   // miss 免疫
  isStudentSeatActive(now) { return this.isBuffActive("student_seat", now); } // 回穩 + 忽略平衡事件
  isCleanerBlocking(now) { return now < this.cleanerBlockUntil; }
}

export function createNpcManager() {
  return new NpcManager();
}
