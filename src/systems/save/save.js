// 搬自 web-build/index.html 第 181-235 行左右(本地存檔 localStorage)。
// 逐字保留邏輯,行為不變。
export const SAVE_KEY = "rubyexpress.save.v1";

export function emptyRuby() {
  return { stationCleared: [false, false, false, false, false], stationBest: [0, 0, 0, 0, 0], bossDefeated: false, bossBestScore: 0, pointsClaimed: [false, false, false, false, false] };
}

export function emptySlot() {
  return { name: "", created: 0, lastPlayed: 0, ruby: emptyRuby(), run: { cards: [] }, best: 0, plays: 0, session: null, pendingArrivalCards: null };
}

export function defaultSave() {
  return {
    playerName: "",
    settings: { volume: 0.8, tilt: true, vibrate: true, offsetMs: 0, balanceInput: "tilt", danmakuOff: false },
    best: { score: 0, maxCombo: 0, accuracy: 0 },
    routes: { ruby: emptyRuby() },
    slots: [emptySlot(), emptySlot(), emptySlot()],   // #3 三存檔格(各自通勤進度 + 肉鴿卡)
    activeSlot: 0,
    achievements: {},
    stats: { plays: 0, totalPerfect: 0, bossKills: 0, mileage: 0 },   // 累積哩程
    points: 0,   // 哩程點數(可花費貨幣)
    preorder: { monthlypass: false, loyalty: false },   // 販賣機預購:下一場開場注入
    dailyPointsClaimed: {},   // { "yyyy-mm-dd_taskId": true } 每日任務領過的旗標
    seenTutorial: false,
  };
}

export function loadSave() {
  const d = defaultSave();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SAVE_KEY) : null;
    if (!raw) return d;
    const s = JSON.parse(raw) || {};
    const out = { ...d, ...s };
    out.settings = { ...d.settings, ...(s.settings || {}) };
    out.best = { ...d.best, ...(s.best || {}) };
    out.stats = { ...d.stats, ...(s.stats || {}) };
    out.achievements = { ...(s.achievements || {}) };
    out.routes = { ...d.routes, ...(s.routes || {}) };
    out.routes.ruby = { ...d.routes.ruby, ...((s.routes && s.routes.ruby) || {}) };
    const r = out.routes.ruby;
    if (!Array.isArray(r.stationCleared) || r.stationCleared.length !== 5) r.stationCleared = d.routes.ruby.stationCleared.slice();
    if (!Array.isArray(r.stationBest) || r.stationBest.length !== 5) r.stationBest = d.routes.ruby.stationBest.slice();
    // #3 存檔格:遷移/補齊三格,舊進度放入 slot 0
    if (!Array.isArray(s.slots) || s.slots.length !== 3) {
      out.slots = [emptySlot(), emptySlot(), emptySlot()];
      out.slots[0].ruby = JSON.parse(JSON.stringify(r));   // 舊單檔進度 → 第一格
      out.activeSlot = 0;
    } else {
      out.slots = s.slots.map((sl) => ({ ...emptySlot(), ...sl, ruby: { ...emptyRuby(), ...((sl && sl.ruby) || {}) }, run: { cards: ((sl && sl.run && sl.run.cards) || []) }, session: (sl && sl.session) || null }));
      out.activeSlot = (typeof s.activeSlot === "number" && s.activeSlot >= 0 && s.activeSlot < 3) ? s.activeSlot : 0;
      out.routes.ruby = JSON.parse(JSON.stringify(out.slots[out.activeSlot].ruby));   // 載入使用中格的進度
    }
    return out;
  } catch (e) { return d; }
}

export function writeSave(s) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
}

// 依 stationCleared 推算通勤已解鎖進度(連續通過數 = 下一站解鎖點)
export function clearedProgress(save) {
  const arr = (save && save.routes && save.routes.ruby && save.routes.ruby.stationCleared) || [];
  let n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i]) n = i + 1; }
  return Math.min(5, n);
}

export function todayStr() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "0"; } }
