import { createNpcManager } from "./src/systems/npc/npcManager.js";
import { NOISE_SCORE, BACKPACK_SCORE } from "./src/systems/config/index.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}

// rollSpawn:並存上限擋新抽選
{
  const npc = createNpcManager();
  npc.spawn("phone", 0);
  npc.spawn("kid", 0);
  const result = npc.rollSpawn(0, { npcCap: 2, stability: 100 }, () => 0); // rand=0 一定會過機率門檻
  assert(result === null, "在場數已達 npcCap 時 rollSpawn 回傳 null");
}

// rollSpawn:機率門檻沒過回傳 null
{
  const npc = createNpcManager();
  const result = npc.rollSpawn(0, { npcCap: 2, stability: 100 }, () => 0.99);
  assert(result === null, "rand 超過 chance 門檻時回傳 null");
}

// rollSpawn:穩定度<30 時上限+1、機率x2(用兩次呼叫間接驗證機率變寬鬆)
{
  const npc = createNpcManager();
  // chance = 0.15*1*(stability<30?2:1) = 0.3,rand=0.25 在低穩定度時會過,正常穩定度不會過
  const lowStability = npc.rollSpawn(0, { npcCap: 2, stability: 20 }, () => 0.25);
  assert(lowStability !== null, "低穩定度時機率門檻變寬鬆,rand=0.25 會抽中");
  const npc2 = createNpcManager();
  const normalStability = npc2.rollSpawn(0, { npcCap: 2, stability: 100 }, () => 0.2);
  assert(normalStability === null, "正常穩定度時同樣 rand 不會過 0.15 門檻");
}

// rollSpawn:互斥過濾——已有增益 NPC 時,不會抽到其他增益型別
{
  const npc = createNpcManager();
  npc.spawn("police", 0);
  const result = npc.rollSpawn(0, { npcCap: 5, stability: 100 }, () => 0.001);
  assert(result !== "conductor" && result !== "cleaner" && result !== "staff" && result !== "student_seat", "已有增益 NPC 在場時不會抽到其他增益型別");
}

// rollSpawn:背包客在平衡事件進行中不會被抽到
{
  const npc = createNpcManager();
  let sawBackpack = false;
  for (let i = 0; i < 50; i++) {
    const r = npc.rollSpawn(i * 1000, { npcCap: 5, stability: 100, trainBalanceActive: true }, () => 0.001);
    if (r === "backpack") sawBackpack = true;
  }
  assert(!sawBackpack, "trainBalanceActive=true 時永遠不會抽到 backpack");
}

// spawn:站務員上場清空其他 NPC 實體,但不動 hazard 陣列
{
  const npc = createNpcManager();
  npc.spawn("phone", 0);
  npc.spawn("kid", 0);
  npc.bombs.push({ id: "b1", lane: 0, hitTime: 1 });
  npc.spawn("staff", 0);
  assert(npc.active.length === 1 && npc.active[0].type === "staff", "站務員上場後 active 只剩站務員");
  assert(npc.bombs.length === 1, "站務員上場不影響已存在的炸彈陣列");
}

// spawn:清潔隊員瞬清負面 + 阻擋新負面
{
  const npc = createNpcManager();
  npc.noise.push({ id: "n1", lane: 0, hitTime: 1 });
  npc.bombs.push({ id: "b1", lane: 0, hitTime: 1 });
  npc.backpackStack.push({ id: "bag1", bornAt: 0 });
  npc.spawn("cleaner", 0);
  assert(npc.noise.length === 0 && npc.bombs.length === 0 && npc.backpackStack.length === 0, "清潔隊員上場瞬間清空雜訊/炸彈/背包疊層");
  assert(npc.isCleanerBlocking(1000) === true, "清潔隊員效果期間內阻擋新負面為 true");
  assert(npc.isCleanerBlocking(4000) === false, "超過清潔隊員 duration(3000ms)後不再阻擋");
}

// spawn:背包客回傳 gateRequest 並疊一層 backpackStack
{
  const npc = createNpcManager();
  const { gateRequest } = npc.spawn("backpack", 0, { rand: () => 0.2 });
  assert(gateRequest !== null && gateRequest.needMs === 900, "背包客上場回傳 needMs=900 的 gateRequest");
  assert(npc.backpackStack.length === 1, "背包客上場疊一層 backpackStack");
}

// tick:擴音上班族每 950ms 丟雜訊
{
  const npc = createNpcManager();
  npc.spawn("phone", 0);
  const r1 = npc.tick(940, { rand: () => 0.9 }); // 未達 950ms
  assert(r1.noiseSpawns.length === 0, "未達 950ms 間隔不丟雜訊");
  const r2 = npc.tick(950, { rand: () => 0.9 }); // rand=0.9 >= 0.5 → 2 顆
  assert(r2.noiseSpawns.length === 2, "達 950ms 間隔丟出雜訊(rand>=0.5 為 2 顆)");
}

// tick:亂跑小孩每 850ms 丟炸彈
{
  const npc = createNpcManager();
  npc.spawn("kid", 0);
  const r1 = npc.tick(800, {});
  assert(r1.bombSpawns.length === 0, "未達 850ms 間隔不丟炸彈");
  const r2 = npc.tick(850, {});
  assert(r2.bombSpawns.length === 1, "達 850ms 間隔丟出 1 顆炸彈");
}

// tick:清潔隊員阻擋期間暫停雜訊/炸彈生成
{
  const npc = createNpcManager();
  npc.spawn("phone", 0);
  npc.cleanerBlockUntil = 2000;
  const r = npc.tick(950, { rand: () => 0.9 });
  assert(r.noiseSpawns.length === 0, "清潔隊員阻擋期間內,雜訊不會生成");
}

// tick:占位行李客 remainSpawn 用完後進入 phase2
{
  const npc = createNpcManager();
  npc.spawn("luggage", 0, { rand: () => 0 }); // remainSpawn = 1
  const r = npc.tick(1200, { rand: () => 0.5 });
  assert(r.luggageSpawns.length === 1, "達 1200ms 間隔丟出 1 組雙軌行李箱");
  const luggageNpc = npc.active.find((n) => n.type === "luggage");
  assert(luggageNpc.phase2 === true, "remainSpawn 歸零後進入 phase2");
}

// tick:NPC 到期自動移除
{
  const npc = createNpcManager();
  npc.spawn("couple", 0); // durationMs = 6000
  const r1 = npc.tick(5000, {});
  assert(r1.expiredNpcs.length === 0 && npc.active.length === 1, "未到期前仍在場");
  const r2 = npc.tick(6000, {});
  assert(r2.expiredNpcs.length === 1 && npc.active.length === 0, "到期後自動移除");
}

// tick:站務員零 miss 巡查成功/失敗
{
  const npcOk = createNpcManager();
  npcOk.spawn("staff", 0);
  const rOk = npcOk.tick(8000, {}); // STAFF_DURATION_MS = 8000,全程無 miss
  assert(rOk.staffResult.success === true, "全程無 miss,站務員巡查成功");

  const npcFail = createNpcManager();
  npcFail.spawn("staff", 0);
  npcFail.reportMiss();
  const rFail = npcFail.tick(8000, {});
  assert(rFail.staffResult.success === false, "巡查期間有 miss,結算失敗");
}

// canDismiss:phone 需要連續 2 Great+ / 已在場 1.5s / 已丟 2 次雜訊
{
  const npc = createNpcManager();
  npc.spawn("phone", 0);
  const phoneId = npc.active[0].id;
  assert(npc.canDismiss("phone", phoneId, 2000, { greatPlusStreak: 2 }) === false, "雜訊次數不足時不能驅散");
  npc.noiseAttackCount.set(phoneId, 2);
  assert(npc.canDismiss("phone", phoneId, 1000, { greatPlusStreak: 2 }) === false, "在場時間不足 1.5s 時不能驅散");
  assert(npc.canDismiss("phone", phoneId, 2000, { greatPlusStreak: 1 }) === false, "greatPlusStreak 不足時不能驅散");
  assert(npc.canDismiss("phone", phoneId, 2000, { greatPlusStreak: 2 }) === true, "三個條件都滿足才能驅散");
}

// canDismiss:kid 需要連續 4 Perfect
{
  const npc = createNpcManager();
  assert(npc.canDismiss("kid", "x", 0, { perfectStreak: 3 }) === false, "連續 3 Perfect 不足以驅散小孩");
  assert(npc.canDismiss("kid", "x", 0, { perfectStreak: 4 }) === true, "連續 4 Perfect 可以驅散小孩");
}

// popBackpackStack:連續 2 Perfect 拍掉最舊一疊 +300 分
{
  const npc = createNpcManager();
  npc.backpackStack.push({ id: "a", bornAt: 0 }, { id: "b", bornAt: 1 });
  assert(npc.popBackpackStack(1) === null, "連續 1 Perfect 不足以拍掉背包疊層");
  const result = npc.popBackpackStack(2);
  assert(result.scoreDelta === BACKPACK_SCORE, "連續 2 Perfect 拍掉疊層得分正確");
  assert(npc.backpackStack.length === 1, "只拍掉最舊一疊");
}

// hitBomb / hitNoise / hitLuggageDouble
{
  const npc = createNpcManager();
  npc.bombs.push({ id: "b1", lane: 0, hitTime: 1 });
  assert(npc.hitBomb("b1").hit === true, "hitBomb 命中後從盤面移除");
  assert(npc.bombs.length === 0, "炸彈確實被移除");

  npc.noise.push({ id: "n1", lane: 0, hitTime: 1 });
  const noiseResult = npc.hitNoise("n1");
  assert(noiseResult.hit === true && noiseResult.scoreDelta === NOISE_SCORE, "hitNoise 命中得分正確");

  npc.luggage.push({ id: "l1", pairStart: 2, hitTime: 1 });
  const partial = npc.hitLuggageDouble("l1", [2]);
  assert(partial.hit === false, "只按一邊不算命中");
  const full = npc.hitLuggageDouble("l1", [2, 3]);
  assert(full.hit === true && full.scoreDelta === 150 && full.double === true, "兩軌都按到才算雙軌命中,+150 分");
}

// 增益效果查詢
{
  const npc = createNpcManager();
  npc.spawn("police", 1000);
  assert(npc.isPoliceActive(1000) === true, "捷運警察剛上場時生效");
  assert(npc.isPoliceActive(1000 + 8000) === false, "超過 duration 後失效");

  const npc2 = createNpcManager();
  npc2.spawn("student_seat", 0);
  assert(npc2.isStudentSeatActive(4000) === true, "讓座學生 5000ms duration 內生效");
  assert(npc2.isStudentSeatActive(6000) === false, "超過 duration 後失效");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
