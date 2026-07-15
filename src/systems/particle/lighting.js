// LightingManager —— 「動態光源/色調疊層」資料模型(新增系統,原始碼沒有
// 這層概念,目前是靠各處各自硬寫 CSS keyframe 達成,例如 boss-phase-alert
// 的紅色掃光、嚴重失衡的畫面警示)。
//
// 跟 `effect/shake.js` 的 ScreenShake 是同一套「觸發後線性衰減」設計精神,
// 差別在 ScreenShake 全域只有一份狀態,這裡是「多頻道(channel)」——BOSS
// 階段警示、嚴重失衡警戒、combo 光暈這幾種光效彼此獨立,不應該互相打斷
// (BOSS 進入 P3 的紅色警示不該被同時觸發的 combo 金色光暈蓋掉,反之亦然),
// 所以每個 channel 各自維護自己的觸發狀態,只有「同一個 channel 內」才套用
// 「更強的衝擊不會被較弱的打斷」規則。
//
// 純數學,不碰 DOM/React:同一組 (state, now) 一定算出同一個結果。
function decay(entry, now) {
  if (!entry) return 0;
  const t = now - entry.startAt;
  if (t >= entry.durationMs) return 0;
  return 1 - t / entry.durationMs; // 1(剛觸發) → 0(播完)
}

export class LightingManager {
  constructor() {
    this._channels = new Map(); // name -> { color, intensity, startAt, durationMs }
  }

  // intensity:0~1 的基準強度(渲染端會再乘上衰減比例),color 建議傳
  // CSS 顏色字串(hex/rgb 皆可,這裡不解析,只是原封不動存起來給渲染端用)。
  trigger(channel, { color = "#fff", intensity = 1, durationMs = 500 } = {}, now = Date.now()) {
    const cur = this._channels.get(channel);
    if (cur) {
      const remaining = cur.startAt + cur.durationMs - now;
      // 同一頻道內,較弱的觸發不會打斷還沒播完的較強觸發。
      if (remaining > 0 && intensity < cur.intensity) return;
    }
    this._channels.set(channel, { color, intensity, startAt: now, durationMs });
  }

  // 目前這一刻的 {intensity, color},intensity 已套用衰減(0 表示熄滅)。
  getChannel(channel, now = Date.now()) {
    const entry = this._channels.get(channel);
    if (!entry) return { intensity: 0, color: "#fff" };
    const k = decay(entry, now);
    return { intensity: entry.intensity * k, color: entry.color };
  }

  isActive(channel, now = Date.now()) {
    return this.getChannel(channel, now).intensity > 0;
  }

  // 一次拿到所有「目前有紀錄過」的頻道狀態(含已經衰減到 0 的),方便渲染端
  // 一次迭代畫出全部疊層(intensity=0 的渲染端可以自行跳過)。
  getAll(now = Date.now()) {
    const out = {};
    for (const name of this._channels.keys()) out[name] = this.getChannel(name, now);
    return out;
  }

  clearChannel(channel) {
    this._channels.delete(channel);
  }

  reset() {
    this._channels.clear();
  }
}

export function createLightingManager() {
  return new LightingManager();
}

// LIGHTING_PRESETS —— 對照 HANDOFF.md 記錄過的既有演出時機(BOSS P2/P3
// 階段警示、嚴重失衡警戒、combo 光暈)整理成的參考設定,純文件+方便呼叫端
// 一行套用,沒有被任何畫面實際呼叫過。跟 web-build/index.html 現有的
// boss-phase-alert 疊圖 + CSS 掃光是「不同套實作」,不是要取代它——這裡是
// web-build-next 重構要用的新資料模型,兩邊在對應接線之前互不影響。
export const LIGHTING_PRESETS = {
  // BOSS 50% 血量門檻警示(暴走):橘黃色調,800ms 自動淡出,對照
  // HANDOFF.md「P2(50%門檻/暴走)... setPhaseAlert(2) + 800ms 後自動清除」。
  bossPhaseAlertP2(lighting, now = Date.now()) {
    lighting.trigger("bossPhaseAlert", { color: "#FFA83C", intensity: 0.9, durationMs: 800 }, now);
  },
  // BOSS 30% 血量門檻警示(狂暴):偏紅色調,同樣 800ms。
  bossPhaseAlertP3(lighting, now = Date.now()) {
    lighting.trigger("bossPhaseAlert", { color: "#FF3C3C", intensity: 1, durationMs: 800 }, now);
  },
  // 嚴重失衡警戒:紅色暗角,對照 GameEngine 的嚴重失衡 lockout(2 秒)
  // 時長一致,方便接線時直接共用同一個時間常數概念。
  dangerVignette(lighting, now = Date.now()) {
    lighting.trigger("dangerVignette", { color: "#FF2222", intensity: 0.8, durationMs: 2000 }, now);
  },
  // combo 里程碑光暈:金色調,呼應 particle 的 comboMilestone 噴發跟
  // camera 的 punchZoom,門檻越高強度/時長越明顯。
  comboAura(lighting, tier, now = Date.now()) {
    const intensity = tier >= 300 ? 1 : tier >= 200 ? 0.85 : tier >= 100 ? 0.65 : 0.45;
    lighting.trigger("comboAura", { color: "#FFD700", intensity, durationMs: 400 + tier }, now);
  },
};

/** @param {LightingManager} lighting */
export function applyLightingPreset(lighting, name, ...args) {
  const preset = LIGHTING_PRESETS[name];
  if (!preset) throw new Error(`applyLightingPreset: 未知的 preset "${name}"`);
  return preset(lighting, ...args);
}
