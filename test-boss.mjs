import { createBossManager, phaseForHp } from "./src/systems/boss/bossManager.js";
import { BOSS_HP, PLAYER_HP, BOSS_DMG_PER_HIT, BOSS_FINISHER_HP, APPROACH_SEC } from "./src/systems/config/index.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}
function near(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

// phaseForHp:三段門檻
{
  assert(phaseForHp(100) === 1, "hp=100 是 phase 1");
  assert(phaseForHp(51) === 1, "hp=51 仍是 phase 1");
  assert(phaseForHp(50) === 2, "hp=50 進入 phase 2");
  assert(phaseForHp(31) === 2, "hp=31 仍是 phase 2");
  assert(phaseForHp(30) === 3, "hp=30 進入 phase 3");
  assert(phaseForHp(0) === 3, "hp=0 仍是 phase 3");
}

// 初始狀態
{
  const boss = createBossManager();
  assert(boss.hp === BOSS_HP && boss.playerHp === PLAYER_HP, "初始 hp/playerHp 為滿血");
  assert(boss.phase === 1 && boss.outcome === null, "初始 phase=1,outcome=null");
}

// applyHit:傷害公式(perfect,無 combo 加成)
{
  const boss = createBossManager();
  const r = boss.applyHit("perfect", {});
  assert(near(r.bossDmg, BOSS_DMG_PER_HIT), "perfect 無 combo 加成傷害 = BOSS_DMG_PER_HIT");
  assert(near(boss.hp, BOSS_HP - BOSS_DMG_PER_HIT), "hp 正確扣除");
  assert(r.selfDmg === 0, "perfect 判定自傷為 0");
}

// applyHit:combo 倍率門檻
{
  const boss = createBossManager();
  const r10 = boss.applyHit("great", { combo: 10 });
  assert(near(r10.bossDmg, 0.6 * BOSS_DMG_PER_HIT * 1.2), "combo>=10 套用 1.2 倍");
  const boss2 = createBossManager();
  const r20 = boss2.applyHit("great", { combo: 20 });
  assert(near(r20.bossDmg, 0.6 * BOSS_DMG_PER_HIT * 1.5), "combo>=20 套用 1.5 倍");
}

// applyHit:miss 判定自傷,不傷 BOSS
{
  const boss = createBossManager();
  const r = boss.applyHit("miss", {});
  assert(r.bossDmg === 0, "miss 對 BOSS 無傷害");
  assert(r.selfDmg > 0, "miss 對玩家有自傷");
}

// checkPhaseGate:hp 掉到 50/30 以下各觸發一次 g50/g30,且只觸發一次
{
  const boss = createBossManager();
  boss.hp = 50;
  assert(boss.checkPhaseGate() === "g50", "hp<=50 觸發 g50");
  assert(boss.checkPhaseGate() === null, "g50 只觸發一次");
  boss.hp = 30;
  assert(boss.checkPhaseGate() === "g30", "hp<=30 觸發 g30");
  assert(boss.phase === 3, "phase 正確更新為 3");
}

// finisher:hp 打到門檻以下鎖血,傷害幾乎打不動
{
  const boss = createBossManager();
  boss.hp = BOSS_FINISHER_HP + 1; // 5
  const r = boss.applyHit("perfect", {});
  assert(r.finisherTriggered === true, "hp 降到 finisher 門檻以下觸發 finisher");
  assert(boss.hp === BOSS_FINISHER_HP, "hp 鎖在 FINISHER_HP");
  assert(boss.finisherLocked === true, "finisherLocked 設為 true");
  const r2 = boss.applyHit("perfect", {});
  assert(boss.hp === BOSS_FINISHER_HP, "鎖血期間再次命中,hp 仍鎖在 FINISHER_HP(幾乎打不動)");
  assert(r2.finisherTriggered === false, "鎖血期間不會重複觸發 finisherTriggered");
}

// hold QTE:成功(held 達到 100%)
{
  const boss = createBossManager();
  boss.finisherLocked = true;
  boss.hp = BOSS_FINISHER_HP;
  const hold = boss.startHoldAttack(0, true, { rand: () => 0 });
  boss.tickHold(hold.need, true); // 一次補滿
  const result = boss.resolveHold(hold.deadline);
  assert(result.success === true, "held 滿足 need 判定成功");
  assert(boss.finisherLocked === false, "finisher 成功後解除鎖血");
  assert(boss.hp === 0, "finisher 成功 hp 歸零(觸發死亡判定)");
  assert(boss.checkDeath() === "win", "hp=0 判定 outcome=win");
}

// hold QTE:失敗(held 不足),扣分+扣血,finisherLocked 保持
{
  const boss = createBossManager();
  boss.finisherLocked = true;
  boss.hp = BOSS_FINISHER_HP;
  const hold = boss.startHoldAttack(0, true, { rand: () => 0 });
  boss.tickHold(hold.need / 2, true); // 只補一半
  const result = boss.resolveHold(hold.deadline);
  assert(result.success === false, "held 不足判定失敗");
  assert(result.scoreDelta < 0, "失敗扣分");
  assert(result.damage === boss.maxPlayerHp * 0.4, "失敗扣血 = 玩家最大 HP 的 40%");
  assert(boss.finisherLocked === true, "失敗後 finisherLocked 保持 true(下次命中再觸發)");
}

// hold QTE:無敵狀態下失敗不扣血
{
  const boss = createBossManager();
  const hold = boss.startHoldAttack(0, false, { rand: () => 0 });
  boss.tickHold(0, true);
  const result = boss.resolveHold(hold.deadline, { invincible: true });
  assert(result.damage === 0, "無敵狀態下失敗不扣血");
}

// 平衡對抗閘門:達標(pct>=0.3)回血+得分
{
  const boss = createBossManager();
  boss.playerHp = 50;
  const gate = boss.startGate(0, "g50", { rand: () => 0, burstMs: 0, needMs: 1000, clashMs: 2000 });
  // 模擬持續抵抗到 heldMs 達到 needMs 的 40%(超過 0.3 門檻)
  gate.heldMs = 400;
  const result = boss.resolveGate(gate.deadline);
  assert(result.met === true, "pct=0.4 >= 0.3 門檻,判定達標");
  assert(result.heal > 0 && boss.playerHp > 50, "達標會回血");
  assert(boss.eventStats.g50 !== null, "eventStats.g50 有記錄結果");
}

// 平衡對抗閘門:未達標扣血
{
  const boss = createBossManager();
  boss.playerHp = 50;
  const gate = boss.startGate(0, "g30", { rand: () => 0, burstMs: 0, needMs: 1000, clashMs: 2000 });
  gate.heldMs = 100; // pct=0.1 < 0.3
  const result = boss.resolveGate(gate.deadline);
  assert(result.met === false, "pct=0.1 < 0.3 門檻,判定未達標");
  assert(result.damage > 0 && boss.playerHp < 50, "未達標會扣血");
}

// 死亡判斷:玩家 HP 歸零 → lose
{
  const boss = createBossManager();
  boss.playerHp = 0;
  assert(boss.checkDeath() === "lose", "playerHp<=0 判定 outcome=lose");
}

// 復活:points 不足會失敗,足夠會成功且只能用一次
{
  const boss = createBossManager();
  boss.playerHp = 0;
  boss.outcome = "lose";
  const failResult = boss.revive(0, { points: 10, cost: 80 });
  assert(failResult.ok === false && failResult.reason === "points", "points 不足復活失敗");
  const okResult = boss.revive(0, { points: 100, cost: 80 });
  assert(okResult.ok === true, "points 足夠復活成功");
  assert(boss.playerHp === boss.maxPlayerHp, "復活後回滿血");
  assert(boss.playerInvincibleUntil === 3000, "復活後有 3 秒無敵(now=0 時 until=3000)");
  assert(boss.outcome === null, "復活後 outcome 清空");
  const reuseResult = boss.revive(0, { points: 100, cost: 80 });
  assert(reuseResult.ok === false && reuseResult.reason === "used", "復活只能用一次");
}

// 復活:finisher 鎖血期間死亡復活會重新開一次 finisher QTE
{
  const boss = createBossManager();
  boss.finisherLocked = true;
  boss.playerHp = 0;
  boss.revive(0, { points: 100 });
  assert(boss.hold !== null && boss.hold.isFinisher === true, "finisher 鎖血期間復活重新開啟 finisher QTE");
}

// 重新挑戰:整場重置
{
  const boss = createBossManager();
  boss.hp = 10; boss.phase = 3; boss.outcome = "lose";
  boss.retry();
  assert(boss.hp === BOSS_HP && boss.phase === 1 && boss.outcome === null, "retry() 完整重置狀態");
}

// spawnWave:P1 只生 1 顆,P3 sweep 生 3 顆連續軌道
{
  const boss = createBossManager();
  const p1Wave = boss.spawnWave(0, { rand: () => 0.9 });
  assert(p1Wave.length === 1, "phase 1 固定生 1 顆");

  boss.phase = 3;
  const sweepWave = boss.spawnWave(0, { rand: () => 0.1 }); // roll<0.35 → sweep
  assert(sweepWave.length === 3, "phase 3 sweep 生 3 顆");
  const lanes = sweepWave.map((b) => b.lane);
  assert(Math.abs(lanes[1] - lanes[0]) === 1 && Math.abs(lanes[2] - lanes[1]) === 1, "sweep 三顆是連續軌道");
}

// spawnWave:每顆彈幕都要帶 `fallSec`,渲染端才能算出正確的減速下落曲線
// (2026-07-15t 迴歸測試——之前 `fallSec` 雖然算出來了,但呼叫端塞進畫面
// 陣列時漏掉這個欄位,導致 sunglasses 減速視覺上完全沒有效果)。
{
  const boss = createBossManager();
  const normal = boss.spawnWave(0, { rand: () => 0.9 });
  assert(normal[0].fallSec === APPROACH_SEC, "沒開減速時 fallSec 就是正常的 APPROACH_SEC");
  const slowed = boss.spawnWave(0, { rand: () => 0.9, slowActive: true });
  assert(near(slowed[0].fallSec, APPROACH_SEC * 1.7), "sunglasses 生效時 fallSec 拉長為 1.7 倍");
}

// rollSpecialMove:phase 1 只有 signal,phase 2/3 可能是 spit
{
  const boss = createBossManager();
  assert(boss.rollSpecialMove(() => 0.9) === "signal", "phase 1 只會選到 signal");
  boss.phase = 2;
  assert(boss.rollSpecialMove(() => 0.9) === "spit", "phase 2 rand 接近 1 選到 spit");
}

// specialMoveBullets:signal 保證不同軌
{
  const boss = createBossManager();
  boss.phase = 3;
  const bullets = boss.specialMoveBullets("signal", 0, { rand: () => 0.5 });
  assert(bullets.length === 5, "phase 3 signal 生 5 顆");
  const uniqueLanes = new Set(bullets.map((b) => b.lane));
  assert(uniqueLanes.size === bullets.length, "signal 每顆都在不同軌道");
  assert(bullets.every((bl) => bl.fallSec === APPROACH_SEC), "specialMoveBullets 每顆也要帶 fallSec(2026-07-15t 迴歸測試)");
}

// specialMoveBullets:slowActive(墨鏡道具生效)讓特招彈幕也套用 1.7 倍
// 下落時間,2026-07-15s 補上(之前只有 spawnWave() 接了這個參數)。
{
  const boss = createBossManager();
  const normal = boss.specialMoveBullets("spit", 0, { rand: () => 0 });
  const slowed = boss.specialMoveBullets("spit", 0, { rand: () => 0, slowActive: true });
  assert(near(slowed[0].hitTime - normal[0].hitTime, APPROACH_SEC * 0.7), "sunglasses 生效時特招彈幕的下落時間對照多拉長 APPROACH_SEC*0.7(即 1.7 倍)");
}

// rollExtraChartNote:phase 1 永遠不插,phase 2/3 依機率/延遲不同
{
  const boss = createBossManager();
  assert(boss.rollExtraChartNote(() => 0) === null, "phase 1 永遠不插額外音符");
  boss.phase = 2;
  assert(boss.rollExtraChartNote(() => 0.99) === null, "phase 2 rand 超過 0.3 門檻不插");
  assert(boss.rollExtraChartNote(() => 0.1).delaySec === 0.05, "phase 2 命中時延遲 0.05s");
  boss.phase = 3;
  assert(boss.rollExtraChartNote(() => 0.99) === null, "phase 3 rand 超過 0.5 門檻不插");
  assert(boss.rollExtraChartNote(() => 0.1).delaySec === 0.08, "phase 3 命中時延遲 0.08s");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
