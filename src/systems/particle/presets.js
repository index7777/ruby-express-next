// PARTICLE_PRESETS —— 對照 particle/README.md 搬入範圍寫的三類場景(combo
// 里程碑噴發、Perfect/Great 打擊粒子、爆炸/衝擊波碎屑)的參考設定值,跟
// `camera/presets.js`/`CAMERA_PRESETS` 同樣的角色:純資料 + 一個方便呼叫端
// 一行套用的 helper,沒有被任何畫面實際呼叫過,數值之後接線試玩大概率要調整。
import { ParticleManager } from "./particleManager.js";

const GOLD = ["#FFD700", "#FFEA9E", "#FFA800"];
const CYAN = ["#63C2FF", "#B6ECFF"];
const EMBER = ["#FF9F45", "#FF5A2E", "#FFD08A"];

export const PARTICLE_PRESETS = {
  // combo 里程碑(50/100/200/300):門檻越高,顆數/速度/存活時間越誇張,
  // 呼應 effect/fxManager.js 的 combo 視覺里程碑跟 camera/presets.js 的
  // comboMilestone punchZoom——三個系統各自負責 文字浮現 / 鏡頭衝擊 /
  // 碎屑噴發,同一個時機一起觸發。
  comboMilestone(pm, x, y, tier, opts) {
    const scale = tier >= 300 ? 3 : tier >= 200 ? 2.2 : tier >= 100 ? 1.5 : 1;
    return pm.emit(x, y, {
      count: Math.round(16 * scale),
      angleMin: 0, angleMax: Math.PI * 2,
      speedMin: 60 * Math.min(scale, 1.6), speedMax: 160 * Math.min(scale, 1.8),
      gravity: 220, drag: 0.6,
      sizeMin: 2, sizeMax: 5,
      lifeMsMin: 350, lifeMsMax: 550 + tier,
      colors: GOLD, vrotateMax: 6,
    }, opts);
  },

  // Perfect/Great 打擊:判定線附近小範圍噴出幾點亮粉,方向朝上(負 y),
  // 比 comboMilestone 收斂很多,不喧賓奪主。
  perfectHit(pm, x, y, opts) {
    return pm.emit(x, y, {
      count: 6,
      angleMin: Math.PI * 1.15, angleMax: Math.PI * 1.85, // 朝上小扇形
      speedMin: 50, speedMax: 110,
      gravity: 260, drag: 0.5,
      sizeMin: 1.5, sizeMax: 3,
      lifeMsMin: 180, lifeMsMax: 260,
      colors: GOLD,
    }, opts);
  },
  greatHit(pm, x, y, opts) {
    return pm.emit(x, y, {
      count: 4,
      angleMin: Math.PI * 1.15, angleMax: Math.PI * 1.85,
      speedMin: 40, speedMax: 90,
      gravity: 260, drag: 0.5,
      sizeMin: 1.5, sizeMax: 2.5,
      lifeMsMin: 150, lifeMsMax: 220,
      colors: CYAN,
    }, opts);
  },

  // 爆炸/衝擊波碎屑(BOSS 死亡、必殺技命中):大量、全方向、有重力會真的
  // 落下,存活時間拉長讓碎屑有機會飄落到畫面下緣。
  explosion(pm, x, y, opts) {
    return pm.emit(x, y, {
      count: 40,
      angleMin: 0, angleMax: Math.PI * 2,
      speedMin: 80, speedMax: 260,
      gravity: 320, drag: 0.35,
      sizeMin: 2, sizeMax: 6,
      lifeMsMin: 400, lifeMsMax: 800,
      colors: EMBER, vrotateMax: 10,
    }, opts);
  },

  // Express 必殺衝刺拖尾:呼叫端建議每幀/每隔幾十 ms 呼叫一次,每次噴少量、
  // 幾乎不擴散(速度範圍窄、朝噴發反方向的角度由呼叫端算好傳入
  // angleMin===angleMax 即可鎖定單一方向),存活時間短,製造連續拖尾感。
  trail(pm, x, y, angle, opts) {
    return pm.emit(x, y, {
      count: 2,
      angleMin: angle - 0.25, angleMax: angle + 0.25,
      speedMin: 10, speedMax: 40,
      gravity: 0, drag: 1.2,
      sizeMin: 2, sizeMax: 4,
      lifeMsMin: 200, lifeMsMax: 320,
      colors: CYAN,
    }, opts);
  },
};

/** @param {ParticleManager} pm */
export function emitParticlePreset(pm, name, ...args) {
  const preset = PARTICLE_PRESETS[name];
  if (!preset) throw new Error(`emitParticlePreset: 未知的 preset "${name}"`);
  return preset(pm, ...args);
}
