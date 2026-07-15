// items —— 道具充能/啟用狀態機 + 必殺技(Express)集氣,逐字對照原始碼
// `useItem()`/`fireExpress()`/`expressBlast()`/`refillRandomItem()`(散落在
// 1840-1980/2440-2500/3140-3170 行)。跟 `boss/bossManager.js`/
// `npc/npcManager.js` 同樣的 Contract:純狀態機,不碰 DOM/React,亂數/時間
// 一律由呼叫端傳入。
//
// 只做「一般行駛階段(running)」的道具效果——BOSS 戰的道具分支(headphone
// 變成傷害護盾、sunglasses 變成彈幕減速、clearcard 清彈幕而不是清 NPC)
// 由呼叫端(`BossScene.jsx`)自己讀 `ITEM_DEFS`/呼叫這裡的 `useItem()` 拿到
// 充能/啟用時間戳後,自己決定 running/boss 兩種語意分支怎麼用這些狀態,
// 這裡不寫死只能用在哪個場景。
import { ITEM_DEFS, EXPRESS_NEED, EXPRESS_GAIN, ITEM_MAX_CHARGE, EXPRESS_SWEEP_MS } from "../config/index.js";

const REFILLABLE = ["headphone", "sunglasses", "clearcard"];
const REGEN_PHONE_INTERVAL_MS = 15000; // regenphone 卡:每 15 秒補 1 次耳機充能
const PRIORITY_SEAT_INTERVAL_MS = 8000; // priorityseat 卡:每 8 秒回 2 穩定度
const PRIORITY_SEAT_STABILITY = 2;

export class ItemManager {
  constructor() {
    this.reset();
  }

  reset() {
    // 對照原始碼 initItemCharges():headphone/sunglasses/clearcard 各 1 充能,
    // express 不用充能,用另一套集氣量表示。
    this.charges = { headphone: 1, sunglasses: 1, clearcard: 1 };
    this.activeUntil = { headphone: 0, sunglasses: 0, clearcard: 0 };
    this.expressCharge = 0;
    this.expressReady = false;
    this.expressUntil = 0; // 必殺技觸發後的「順帶清掉隨後生成音符」視窗
    this._regenPhoneAt = null; // null = 還沒起算(不能用 0,now=0 是合法的真實時間戳,拿 0 當「未初始化」判斷會撞在一起)
    this._prioritySeatAt = null;
  }

  canUse(key) {
    if (key === "express") return this.expressReady;
    return (this.charges[key] || 0) > 0;
  }

  isActive(key, now) {
    return now < (this.activeUntil[key] || 0);
  }

  // useItem:headphone/sunglasses/clearcard 三種充能型道具共用的啟用邏輯。
  // clearcard 是瞬發(對照原始碼 `activeUntil = now`,視為立刻過期,不是
  // 持續 buff),`rogue.headphoneDurMult` 對應 quietcar 卡延長耳機時間。
  useItem(key, now, { rogue = {} } = {}) {
    if (key === "express") return null; // express 走 fireExpress(),不是這裡
    if (!this.canUse(key)) return null;
    this.charges[key] -= 1;
    if (key === "clearcard") {
      this.activeUntil.clearcard = now;
      return { key, instant: true, activeUntil: now };
    }
    const def = ITEM_DEFS[key];
    const durMult = key === "headphone" ? (rogue.headphoneDurMult || 1) : 1;
    this.activeUntil[key] = now + def.durationMs * durMult;
    return { key, instant: false, activeUntil: this.activeUntil[key] };
  }

  // addExpressCharge:對照 `addExpressCharge()`,每次 Perfect/Great/Good
  // 判定呼叫(miss 不呼叫,不倒扣)。comboBonus 在 60 combo 時封頂 2 倍,
  // `expressMult` 對應 charge 卡(1.25 倍)。
  addExpressCharge(category, combo, expressMult = 1) {
    const base = EXPRESS_GAIN[category];
    if (!base) return;
    const comboBonus = 1 + Math.min(combo, 60) / 60;
    this.expressCharge = Math.min(EXPRESS_NEED, this.expressCharge + base * comboBonus * expressMult);
    if (this.expressCharge >= EXPRESS_NEED) this.expressReady = true;
  }

  // fireExpress:對照 `fireExpress()`,觸發後歸零重新集氣,開一個 1200ms
  // 的「順帶清掉隨後生成音符」視窗(對照原始碼兩波爆炸的第一波),實際
  // 「炸掉盤面上所有音符」的效果由呼叫端用 `expressBlastResult()` 算分數/
  // 回穩,這裡只管集氣狀態機本身。
  fireExpress(now) {
    if (!this.expressReady) return null;
    this.expressCharge = 0;
    this.expressReady = false;
    this.expressUntil = now + EXPRESS_SWEEP_MS;
    return { key: "express", firedAt: now, sweepUntil: this.expressUntil };
  }

  isExpressSweepActive(now) {
    return now < this.expressUntil;
  }

  // refillRandomItem:對照 `refillRandomItem()`,從還沒充滿的
  // headphone/sunglasses/clearcard 裡隨機挑一個 +1 充能。站務員巡查通過/
  // 進站(loyalty/announce 卡的 `refillCount`)都呼叫這個。
  refillRandomItem(rand = Math.random) {
    const candidates = REFILLABLE.filter((k) => this.charges[k] < ITEM_MAX_CHARGE);
    if (candidates.length === 0) return null;
    const key = candidates[Math.floor(rand() * candidates.length) % candidates.length];
    this.charges[key] += 1;
    return key;
  }

  // refillAll:monthlypass 卡的一次性效果(選卡當下呼叫,不是 rogue 常駐
  // 欄位,見 `judge/rogue.js` 開頭註解)。
  refillAll() {
    for (const k of REFILLABLE) this.charges[k] = ITEM_MAX_CHARGE;
  }

  // ── regenphone/priorityseat 兩張卡的計時器效果 ──
  // 呼叫端每個 tick 呼叫,`active` 是這張卡有沒有被選中,內部自己記錄
  // 上次觸發時間,到間隔就觸發一次並回傳觸發結果,沒到就回傳 null。
  tickRegenPhone(now, active) {
    if (!active) return null;
    if (this._regenPhoneAt === null) { this._regenPhoneAt = now; return null; }
    if (now - this._regenPhoneAt < REGEN_PHONE_INTERVAL_MS) return null;
    this._regenPhoneAt = now;
    if (this.charges.headphone >= ITEM_MAX_CHARGE) return null;
    this.charges.headphone += 1;
    return { key: "headphone", charges: this.charges.headphone };
  }

  tickPrioritySeat(now, active) {
    if (!active) return null;
    if (this._prioritySeatAt === null) { this._prioritySeatAt = now; return null; }
    if (now - this._prioritySeatAt < PRIORITY_SEAT_INTERVAL_MS) return null;
    this._prioritySeatAt = now;
    return { stabilityDelta: PRIORITY_SEAT_STABILITY };
  }
}

export function createItemManager() {
  return new ItemManager();
}

// expressBlastResult:對照 `expressBlast()` 的一般行駛階段分支(非 BOSS)
// ——每顆炸掉的音符算一次 Perfect(固定 100 分,不是套用一般判定的
// combo/rogue 分數公式),回穩上限 12(`min(12, cnt*0.5)`)。BOSS 分支的
// 「每顆呼叫 bossApplyHit("perfect")」由呼叫端(`BossScene.jsx`)自己
// 迴圈呼叫 `BossManager.applyHit()`,不需要另外的純函式包裝。
export function expressBlastResult(noteCount) {
  return {
    scoreDelta: noteCount * 100,
    stabilityDelta: Math.min(12, noteCount * 0.5),
  };
}
