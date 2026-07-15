import { recalcRogue, createDefaultRogue, rollArrivalCards } from "./src/systems/judge/rogue.js";
import { createItemManager, expressBlastResult } from "./src/systems/judge/items.js";
import { ROGUE_CARDS } from "./src/systems/data/rogue.js";
import { ITEM_MAX_CHARGE, EXPRESS_NEED } from "./src/systems/config/index.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}
function near(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }

// createDefaultRogue:沒選任何卡時的中性值
{
  const r = createDefaultRogue();
  assert(r.scoreMult === 1 && r.missMult === 1 && r.autoPerfect === false, "預設 rogue 狀態是中性值");
}

// recalcRogue:單張卡各自效果正確
{
  assert(recalcRogue(["rushpay"]).npcExtra === 1, "rushpay: npcExtra+1");
  assert(near(recalcRogue(["rushpay"]).scoreMult, 1.3), "rushpay: scoreMult x1.3");
  assert(near(recalcRogue(["punchin"]).missMult, 2), "punchin: missMult x2");
  assert(near(recalcRogue(["punchin"]).perfMult, 1.4), "punchin: perfMult 設 1.4(即使沒有讀取點也照抄)");
  assert(near(recalcRogue(["doublebeat"]).scoreMult, 1.3), "doublebeat: scoreMult x1.3");
  assert(near(recalcRogue(["doublebeat"]).noteRateMult, 1.25), "doublebeat: noteRateMult x1.25");
  assert(near(recalcRogue(["seathell"]).scoreMult, 1.3), "seathell: scoreMult x1.3");
  assert(recalcRogue(["seathell"]).missStabExtra === 3, "seathell: missStabExtra+3");
  assert(near(recalcRogue(["finalsprint"]).scoreMult, 0.85), "finalsprint: scoreMult x0.85");
  assert(near(recalcRogue(["finalsprint"]).bossDmgMult, 1.3), "finalsprint: bossDmgMult x1.3");
  assert(recalcRogue(["quietcar"]).headphoneDurMult === 1.5, "quietcar: headphoneDurMult=1.5");
  assert(recalcRogue(["shades"]).perfWindowMult === 1.3, "shades: perfWindowMult=1.3");
  assert(recalcRogue(["loyalty"]).refillCount === 2, "loyalty: refillCount 1→2");
  assert(recalcRogue(["announce"]).refillCount === 2, "announce: refillCount 1→2");
  assert(near(recalcRogue(["charge"]).expressMult, 1.25), "charge: expressMult x1.25");
  assert(recalcRogue(["ontime"]).stabFloor === 30, "ontime: stabFloor=30");
  assert(near(recalcRogue(["mrtspeed"]).scoreMult, 1.15), "mrtspeed: scoreMult x1.15");
  assert(near(recalcRogue(["aircon"]).missMult, 0.5), "aircon: missMult x0.5");
  assert(recalcRogue(["perfphone"]).perfectBonus === 5, "perfphone: perfectBonus+5");
  assert(recalcRogue(["boardfirst"]).autoPerfect === true, "boardfirst: autoPerfect=true");
  assert(recalcRogue(["comborecover"]).comboRecover === true, "comborecover: comboRecover=true");
  assert(recalcRogue(["regenphone"]).regenPhone === true, "regenphone: regenPhone=true");
  assert(recalcRogue(["priorityseat"]).prioritySeat === true, "priorityseat: prioritySeat=true");
}

// recalcRogue:多張卡疊加 + monthlypass 不在欄位表裡(不影響任何數值)
{
  const r = recalcRogue(["rushpay", "mrtspeed", "monthlypass"]);
  assert(r.npcExtra === 1 && near(r.scoreMult, 1.3 * 1.15), "多張卡疊加正確,monthlypass 不影響任何 recalcRogue 欄位");
}

// recalcRogue:每次都是從預設值重新算,不是遞增(呼叫兩次同一組 id 結果一致)
{
  const a = recalcRogue(["doublebeat"]);
  const b = recalcRogue(["doublebeat"]);
  assert(near(a.scoreMult, b.scoreMult), "recalcRogue 是純函式,同輸入同輸出,不會累積殘留狀態");
}

// rollArrivalCards:排除已擁有的卡,不重複抽
{
  const owned = ROGUE_CARDS.slice(0, 17).map((c) => c.id); // 只留 2 張沒被排除
  const picked = rollArrivalCards(owned, 3, () => 0.5);
  assert(picked.length === 2, "池子只剩 2 張時,最多只能抽到 2 張(降級行為)");
  const ids = new Set(picked.map((c) => c.id));
  assert(ids.size === picked.length, "抽到的卡彼此不重複");
  for (const c of picked) assert(!owned.includes(c.id), "抽到的卡都不在已擁有清單裡");
}
{
  const picked = rollArrivalCards([], 3, () => 0.1);
  assert(picked.length === 3, "沒有已擁有卡時,正常抽 3 張");
}

// ItemManager:初始充能 1、上限 5
{
  const items = createItemManager();
  assert(items.charges.headphone === 1 && items.charges.sunglasses === 1 && items.charges.clearcard === 1, "初始充能都是 1");
  assert(items.canUse("headphone") === true, "有充能可以使用");
}

// ItemManager:useItem 扣充能、設定 activeUntil、headphoneDurMult 生效
{
  const items = createItemManager();
  const result = items.useItem("headphone", 1000, { rogue: { headphoneDurMult: 1.5 } });
  assert(items.charges.headphone === 0, "使用後扣 1 充能");
  assert(result.activeUntil === 1000 + 5000 * 1.5, "quietcar 的 headphoneDurMult 正確延長持續時間");
  assert(items.isActive("headphone", 1000) === true, "剛使用時仍在生效");
  assert(items.isActive("headphone", 1000 + 5000 * 1.5 + 1) === false, "超過持續時間後失效");
}

// ItemManager:充能耗盡不能使用
{
  const items = createItemManager();
  items.useItem("sunglasses", 0, {});
  assert(items.canUse("sunglasses") === false, "充能用完後不能再使用");
  assert(items.useItem("sunglasses", 100, {}) === null, "充能耗盡時 useItem 回傳 null");
}

// ItemManager:clearcard 是瞬發,不是持續 buff
{
  const items = createItemManager();
  const result = items.useItem("clearcard", 500, {});
  assert(result.instant === true, "clearcard 標記為瞬發");
  assert(items.isActive("clearcard", 500) === false, "clearcard 使用當下就不算生效中(對照原始碼 activeUntil=now)");
}

// ItemManager:express 集氣公式(combo 加成 + expressMult)
{
  const items = createItemManager();
  items.addExpressCharge("perfect", 0, 1); // comboBonus = 1 + 0/60 = 1
  assert(near(items.expressCharge, 4.5), "combo=0 時 perfect 集氣 = 基礎值 4.5");
  items.expressCharge = 0;
  items.addExpressCharge("perfect", 60, 1); // comboBonus = 1 + 60/60 = 2(封頂)
  assert(near(items.expressCharge, 9), "combo=60 時集氣加成封頂在 2 倍");
  items.expressCharge = 0;
  items.addExpressCharge("perfect", 120, 1); // 仍封頂在 60
  assert(near(items.expressCharge, 9), "combo 超過 60 仍封頂,不會繼續加成");
  items.expressCharge = 0;
  items.addExpressCharge("miss", 0, 1);
  assert(items.expressCharge === 0, "miss 不會累積集氣");
}

// ItemManager:集滿 100 才 ready,fireExpress 後歸零 + 開啟 sweep 視窗
{
  const items = createItemManager();
  assert(items.canUse("express") === false, "未集滿不能使用必殺技");
  for (let i = 0; i < 30; i++) items.addExpressCharge("perfect", 0, 1); // 4.5*30=135,會被夾在 100
  assert(items.expressCharge === EXPRESS_NEED, "集氣值會被夾在 EXPRESS_NEED 上限,不會超過");
  assert(items.canUse("express") === true, "集滿後可以使用必殺技");
  const result = items.fireExpress(2000);
  assert(result !== null && items.expressCharge === 0 && items.expressReady === false, "觸發後歸零、ready 狀態解除");
  assert(items.isExpressSweepActive(2000) === true, "觸發瞬間 sweep 視窗生效中");
  assert(items.isExpressSweepActive(2000 + 1200 + 1) === false, "超過 1200ms 後 sweep 視窗結束");
}

// ItemManager:refillRandomItem 只補未滿的道具,全滿時回傳 null
{
  const items = createItemManager();
  items.charges = { headphone: ITEM_MAX_CHARGE, sunglasses: ITEM_MAX_CHARGE, clearcard: 2 };
  const key = items.refillRandomItem(() => 0);
  assert(key === "clearcard", "只有 clearcard 未滿,一定補到它");
  assert(items.charges.clearcard === 3, "補了 1 充能");
  items.charges.clearcard = ITEM_MAX_CHARGE;
  assert(items.refillRandomItem(() => 0) === null, "全部充能滿了,refillRandomItem 回傳 null");
}

// ItemManager:refillAll(monthlypass 卡效果)
{
  const items = createItemManager();
  items.charges = { headphone: 0, sunglasses: 1, clearcard: 3 };
  items.refillAll();
  assert(items.charges.headphone === ITEM_MAX_CHARGE && items.charges.sunglasses === ITEM_MAX_CHARGE && items.charges.clearcard === ITEM_MAX_CHARGE, "refillAll 把三種道具都補到上限");
}

// ItemManager:regenphone/priorityseat 計時器效果
{
  const items = createItemManager();
  assert(items.tickRegenPhone(0, false) === null, "沒選 regenphone 卡時不會觸發");
  assert(items.tickRegenPhone(0, true) === null, "第一次呼叫只是起算基準,不會立刻觸發");
  items.charges.headphone = 2;
  assert(items.tickRegenPhone(14999, true) === null, "未滿 15000ms 不觸發");
  const result = items.tickRegenPhone(15000, true);
  assert(result !== null && items.charges.headphone === 3, "滿 15000ms 補 1 充能");

  const items2 = createItemManager();
  items2.tickPrioritySeat(0, true);
  assert(items2.tickPrioritySeat(7999, true) === null, "未滿 8000ms 不觸發");
  const r2 = items2.tickPrioritySeat(8000, true);
  assert(r2.stabilityDelta === 2, "滿 8000ms 回穩 2");
}

// expressBlastResult:非 BOSS 分支的固定分數/回穩公式
{
  const r1 = expressBlastResult(10);
  assert(r1.scoreDelta === 1000, "炸 10 顆音符,每顆固定 100 分");
  assert(r1.stabilityDelta === 5, "回穩 = min(12, 10*0.5) = 5");
  const r2 = expressBlastResult(50);
  assert(r2.stabilityDelta === 12, "回穩上限封頂在 12");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
