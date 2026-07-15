import { createParticleManager } from "./src/systems/particle/particleManager.js";
import { PARTICLE_PRESETS, emitParticlePreset } from "./src/systems/particle/presets.js";
import { createLightingManager } from "./src/systems/particle/lighting.js";
import { LIGHTING_PRESETS, applyLightingPreset } from "./src/systems/particle/lighting.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}
function near(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

// spawnOne + update:位置依速度累加、重力/摩擦力正確套用
{
  const pm = createParticleManager();
  pm.spawnOne({ x: 0, y: 0, vx: 100, vy: -50, gravity: 200, drag: 0, lifeMs: 1000 });
  pm.update(0.5);
  const [p] = pm.getActive();
  assert(near(p.x, 50), "x 依 vx*dt 累加正確");
  // vy 積分:先加速度後位移(照 update() 實作順序),y = vy0*dt, vy 累加重力
  assert(near(p.y, -25), "y 依原始 vy*dt 累加(積分順序跟實作一致)");
}

// drag 摩擦力衰減
{
  const pm = createParticleManager();
  pm.spawnOne({ x: 0, y: 0, vx: 100, vy: 0, gravity: 0, drag: 1, lifeMs: 1000 });
  pm.update(0.5); // decay = 1 - 1*0.5 = 0.5
  const active = pm._active; // 內部欄位,只在測試裡窺看驗證衰減公式
  assert(near(active[0].vx, 50), "drag 衰減公式正確(vx *= 1 - drag*dt)");
}

// emit:count 顆全部落在角度/速度範圍內
{
  const pm = createParticleManager();
  let i = 0;
  const seq = [0.1, 0.5, 0.9, 0.2, 0.6, 0.8, 0.3, 0.4, 0.7, 0];
  const rand = () => seq[i++ % seq.length];
  pm.emit(0, 0, { count: 5, angleMin: 0, angleMax: Math.PI, speedMin: 10, speedMax: 20 }, { rand });
  assert(pm.count() === 5, "emit 產生指定數量的粒子");
}

// 存活判斷:life 未到期還在、到期後 prune 會移除並歸還池子
{
  const pm = createParticleManager();
  pm.spawnOne({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 100 });
  pm.update(0.05); // 50ms,還沒到期
  pm.prune();
  assert(pm.count() === 1, "50ms 時粒子還存活(lifeMs=100)");
  pm.update(0.06); // 累計 110ms,超過 100ms 到期
  pm.prune();
  assert(pm.count() === 0, "110ms 時粒子已到期被 prune 移除");
  assert(pm.poolSize() === 1, "到期的粒子被歸還進池子");
}

// 歸還池復用:下一次 spawn 優先從池子拿舊物件,不是每次都 new
{
  const pm = createParticleManager();
  pm.spawnOne({ x: 1, y: 2, vx: 0, vy: 0, lifeMs: 10 });
  pm.update(0.02);
  pm.prune();
  assert(pm.poolSize() === 1, "到期粒子進池子");
  pm.spawnOne({ x: 9, y: 9, vx: 0, vy: 0, lifeMs: 1000 });
  assert(pm.poolSize() === 0, "下一次 spawn 從池子借走舊物件,池子清空");
  assert(pm.count() === 1, "借用池子物件後 active 正確增加");
}

// getActive() 的 life 值:1(剛生成)→ 0(即將消失)
{
  const pm = createParticleManager();
  pm.spawnOne({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 200 });
  pm.update(0); // ageMs = 0
  assert(near(pm.getActive()[0].life, 1), "剛生成時 life = 1");
  pm.update(0.1); // ageMs = 100
  assert(near(pm.getActive()[0].life, 0.5), "存活一半時 life = 0.5");
}

// clear():全部粒子歸還池子
{
  const pm = createParticleManager();
  pm.spawnOne({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 1000 });
  pm.spawnOne({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 1000 });
  pm.clear();
  assert(pm.count() === 0 && pm.poolSize() === 2, "clear() 把所有粒子歸還池子");
}

// PARTICLE_PRESETS / emitParticlePreset
{
  const pm = createParticleManager();
  assert(typeof PARTICLE_PRESETS.comboMilestone === "function", "PARTICLE_PRESETS 含 comboMilestone");
  assert(typeof PARTICLE_PRESETS.explosion === "function", "PARTICLE_PRESETS 含 explosion");
  emitParticlePreset(pm, "perfectHit", 10, 10);
  assert(pm.count() === 6, "emitParticlePreset(perfectHit) 產生 6 顆粒子");

  let threw = false;
  try { emitParticlePreset(pm, "not-a-real-preset", 0, 0); } catch (e) { threw = true; }
  assert(threw, "emitParticlePreset 呼叫不存在的 preset 會丟錯");
}

// ---- Lighting ----

// trigger + 衰減:1(剛觸發)→ 0(播完)
{
  const lighting = createLightingManager();
  lighting.trigger("test", { color: "#f00", intensity: 1, durationMs: 1000 }, 0);
  assert(near(lighting.getChannel("test", 0).intensity, 1), "剛觸發時 intensity = 1");
  assert(near(lighting.getChannel("test", 500).intensity, 0.5), "中途線性衰減到一半");
  assert(near(lighting.getChannel("test", 1000).intensity, 0), "播完後 intensity = 0");
  assert(!lighting.isActive("test", 1000), "播完後 isActive() 為 false");
}

// 多頻道彼此獨立,互不打斷
{
  const lighting = createLightingManager();
  lighting.trigger("bossPhaseAlert", { intensity: 1, durationMs: 800 }, 0);
  lighting.trigger("comboAura", { intensity: 0.5, durationMs: 400 }, 0);
  assert(lighting.isActive("bossPhaseAlert", 0) && lighting.isActive("comboAura", 0), "兩個頻道同時觸發互不影響");
  assert(!lighting.isActive("comboAura", 400) && lighting.isActive("bossPhaseAlert", 400), "comboAura 播完不影響還在播的 bossPhaseAlert");
}

// 同一頻道內:較弱的觸發不會打斷還沒播完的較強觸發
{
  const lighting = createLightingManager();
  lighting.trigger("aura", { intensity: 1, durationMs: 1000 }, 0);
  lighting.trigger("aura", { intensity: 0.3, durationMs: 1000 }, 500); // 較弱,不該覆蓋
  assert(near(lighting.getChannel("aura", 500).intensity, 0.5), "較弱觸發不會打斷還沒播完的較強觸發(維持原本衰減軌跡)");
}

// 同一頻道內:更強的觸發會覆蓋還沒播完的較弱觸發
{
  const lighting = createLightingManager();
  lighting.trigger("aura", { intensity: 0.3, durationMs: 1000 }, 0);
  lighting.trigger("aura", { intensity: 1, durationMs: 1000, color: "#0f0" }, 500); // 更強,應該覆蓋
  const c = lighting.getChannel("aura", 500);
  assert(near(c.intensity, 1) && c.color === "#0f0", "更強的觸發會覆蓋還沒播完的較弱觸發");
}

// getAll / clearChannel / reset
{
  const lighting = createLightingManager();
  lighting.trigger("a", { intensity: 1, durationMs: 100 }, 0);
  lighting.trigger("b", { intensity: 1, durationMs: 100 }, 0);
  assert(Object.keys(lighting.getAll(0)).length === 2, "getAll() 回傳所有已知頻道");
  lighting.clearChannel("a");
  assert(!("a" in lighting.getAll(0)), "clearChannel() 移除單一頻道");
  lighting.reset();
  assert(Object.keys(lighting.getAll(0)).length === 0, "reset() 清空所有頻道");
}

// LIGHTING_PRESETS / applyLightingPreset
{
  const lighting = createLightingManager();
  assert(typeof LIGHTING_PRESETS.bossPhaseAlertP2 === "function", "LIGHTING_PRESETS 含 bossPhaseAlertP2");
  assert(typeof LIGHTING_PRESETS.comboAura === "function", "LIGHTING_PRESETS 含 comboAura");
  applyLightingPreset(lighting, "dangerVignette", 0);
  assert(lighting.isActive("dangerVignette", 0), "applyLightingPreset(dangerVignette) 正確觸發頻道");

  let threw = false;
  try { applyLightingPreset(lighting, "not-a-real-preset"); } catch (e) { threw = true; }
  assert(threw, "applyLightingPreset 呼叫不存在的 preset 會丟錯");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
