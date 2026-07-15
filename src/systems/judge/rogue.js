// rogue —— 肉鴿卡效果重新計算,逐字對照原始碼 `recalcRogue()`(散落在
// 690-830 行的 state/refs,749-770 行是實際公式)。純函式:給一組已選卡的
// id 陣列(允許概念上重複,雖然抽卡池已經排除同一張卡重複出現),回傳一個
// 可以直接丟給 `judge/gameEngine.js` 的 `engine.setRogue()` 的物件。
//
// Contract 跟 `boss/bossManager.js`/`npc/npcManager.js` 一致:純函式,同一組
// 輸入一定得到同一個結果,不碰任何 React state/DOM。
import { ROGUE_CARDS } from "../data/rogue.js";

// 每張卡對 rogue 狀態的影響,逐字對照原始碼 749-770 行。用 `apply(r)` 這種
// 「拿到目前累積的 r,直接改」的寫法,對照原始碼的 `*=`/`+=` 疊加方式——
// 目前抽卡池已經排除重複卡,所以實際上每張卡最多套用一次,這裡用疊加寫法
//單純是跟原始碼行為一致,不是預期真的會疊加超過一次。
//
// ⚠️ `monthlypass`(加購月票)沒有列在這裡:它的效果是「一次性道具充能
// 補滿」,不是持續性數值,對照原始碼是在 `pickRogueCard()` 選卡當下直接
// 執行的 side effect,不是 `recalcRogue()` 算出來的欄位——呼叫端(場景)
// 選到這張卡時要另外呼叫 `ItemManager.refillAll()`,不是靠這裡。
const ROGUE_EFFECTS = {
  rushpay:      (r) => { r.npcExtra += 1; r.scoreMult *= 1.3; },
  // ⚠️ punchin 的「Perfect +40%」原始碼只把 perfMult 設成 1.4,但整個檔案
  // 找不到任何地方真的讀 `perfMult` 去影響分數——這是原始碼本身沒接完的
  // 死欄位(見 README「跟原始碼的差異」),這裡逐字保留這個「設了但沒人用」
  // 的行為,不是我們沒接,是原始碼本來就沒接。
  punchin:      (r) => { r.missMult *= 2; r.perfMult *= 1.4; },
  doublebeat:   (r) => { r.scoreMult *= 1.3; r.noteRateMult *= 1.25; },
  seathell:     (r) => { r.scoreMult *= 1.3; r.missStabExtra += 3; },
  finalsprint:  (r) => { r.scoreMult *= 0.85; r.bossDmgMult *= 1.3; },
  quietcar:     (r) => { r.headphoneDurMult = 1.5; },
  shades:       (r) => { r.perfWindowMult = 1.3; },
  loyalty:      (r) => { r.refillCount += 1; },
  charge:       (r) => { r.expressMult *= 1.25; },
  ontime:       (r) => { r.stabFloor = Math.max(r.stabFloor, 30); },
  mrtspeed:     (r) => { r.scoreMult *= 1.15; },
  aircon:       (r) => { r.missMult *= 0.5; },
  perfphone:    (r) => { r.perfectBonus += 5; },
  boardfirst:   (r) => { r.autoPerfect = true; },
  comborecover: (r) => { r.comboRecover = true; },
  regenphone:   (r) => { r.regenPhone = true; },
  priorityseat: (r) => { r.prioritySeat = true; },
  announce:     (r) => { r.refillCount += 1; },
};

export function createDefaultRogue() {
  return {
    scoreMult: 1, perfMult: 1, missMult: 1, expressMult: 1, stabFloor: 0,
    npcExtra: 0, refillCount: 1, perfWindowMult: 1, headphoneDurMult: 1,
    perfectBonus: 0, missStabExtra: 0, bossDmgMult: 1, noteRateMult: 1,
    autoPerfect: false, comboRecover: false, regenPhone: false, prioritySeat: false,
  };
}

// recalcRogue:給目前已選的卡 id 陣列,回傳重新算好的完整 rogue 狀態
// (每次都是從預設值重新掃過整個清單算,不是遞增修改,對照原始碼
// `recalcRogue()` 本身的寫法——這樣「這次到底套用了哪些卡」永遠跟
// `runCards` 這份清單完全一致,不會因為呼叫順序累積出跟清單對不上的
// 殘留狀態)。不認得的 id(例如 `monthlypass`,或打錯字)直接跳過。
export function recalcRogue(cardIds = []) {
  const r = createDefaultRogue();
  for (const id of cardIds) {
    const effect = ROGUE_EFFECTS[id];
    if (effect) effect(r);
  }
  return r;
}

// rollArrivalCards:對照原始碼「進站三選一」的抽卡池邏輯(1400-1430 行)——
// 排除本輪已經擁有的卡(`owned`),從剩下的卡裡隨機不重複抽 `count` 張
// (池子不夠 `count` 張就有多少抽多少,對照原始碼同樣的降級行為)。
export function rollArrivalCards(ownedIds = [], count = 3, rand = Math.random) {
  const owned = new Set(ownedIds);
  const pool = ROGUE_CARDS.filter((c) => !owned.has(c.id));
  const picked = [];
  const remaining = [...pool];
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand() * remaining.length);
    picked.push(remaining.splice(idx, 1)[0]);
  }
  return picked;
}
