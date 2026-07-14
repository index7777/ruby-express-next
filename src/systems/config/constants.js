// 搬自 web-build/index.html（原本第 59-370 行左右一帶）。
// Phase 1：純數值/常數搬移，數值與邏輯逐字保留，不做任何行為變更。
// 之後若要調整平衡數值，改這裡就好，不用再去 6000+ 行的主檔案裡找。

export const LANES = [
  { key: "kick",  label: "Kick",  keyChar: "D", track: "#17454E", note: "#33D6F0", glow: "#8CEEFF", shape: "circle" },
  { key: "hihat", label: "HiHat", keyChar: "F", track: "#5C5320", note: "#FFE14D", glow: "#FFF0A0", shape: "square" },
  { key: "snare", label: "Snare", keyChar: "J", track: "#5E2540", note: "#FF5FA2", glow: "#FFA8CE", shape: "diamond" },
  { key: "tom",   label: "Tom",   keyChar: "K", track: "#1E4E35", note: "#59E38C", glow: "#A6F5C4", shape: "triangle" },
  { key: "crash", label: "Crash", keyChar: "L", track: "#5E3A18", note: "#FF9F45", glow: "#FFC58A", shape: "ellipse" },
];
export const KEY_TO_LANE = { d: 0, f: 1, j: 2, k: 3, l: 4 };

export const BASE_BPM = 100;
export const BEAT_SEC = 60 / BASE_BPM;
export const APPROACH_SEC = 1.3;
export const START_DELAY = 1.8;
export const LANE_HEIGHT = 420;
export const FALL_DISTANCE = 480;
// laneArea 是 flex 容器,lane 之間有 gap:6(見 styles.laneTrack 用 flex:1、styles.laneArea 用 gap:6),
// 5 軌之間共 4 個間隔,每軌實際寬度不是單純 100%/5,要扣掉間隔再平分。
// 雙軌行李箱音符(占位背包客攻擊)之前直接用 lane*20% 這種「無間隔」假設算 left/width,
// 跟兩軌實際渲染的位置/寬度對不齊,軌數越後面偏移越明顯,導致玩家依兩軌操作也打不到。
// 這裡回傳「不含 calc() 外層」的純算式片段,方便組合時只在最外層包一次 calc(),避免巢狀 calc(calc(...)) 過度冗長。
export const LANE_GAP_PX = 6;
export const laneWidthExpr = `((100% - ${LANE_GAP_PX * 4}px) / 5)`;
export const laneLeftExpr = (i) => `(${i} * (${laneWidthExpr} + ${LANE_GAP_PX}px))`;

export const WINDOW_PERFECT = 0.05;
export const WINDOW_GREAT = 0.10;
export const WINDOW_GOOD = 0.15;

export const COMBO_TIERS = [
  { min: 100, mult: 2.0 }, { min: 51, mult: 1.6 }, { min: 21, mult: 1.3 }, { min: 0, mult: 1.0 },
];
export function multiplierFor(combo) { return COMBO_TIERS.find((t) => combo >= t.min).mult; }

export const DRIVE_STATES = [
  { name: "停站", mult: 1.0, bg: "#263240", tunnel: false, npcWeight: 0.5, npcCap: 1, duration: 5 },
  { name: "行駛中", mult: 1.0, bg: "#263240", tunnel: false, npcWeight: 1.0, npcCap: 2, duration: 12 },
  { name: "高速行駛", mult: 1.2, bg: "#2B3A4A", tunnel: false, npcWeight: 1.2, npcCap: 2, duration: 10 },
  { name: "隧道區間", mult: 1.0, bg: "#14181D", tunnel: true, npcWeight: 0.2, npcCap: 1, duration: 10 },
];

// combo 里程碑慶祝特效門檻(之後要加更高門檻只需擴充此陣列)
export const COMBO_MILESTONES = [50, 100, 200, 300];

// 平衡事件(對抗玩法):慣性把重心往 push 方向甩,玩家要往反方向(counter)抵抗,把重心維持在中心才算平衡
export const OPP_DIR = { left: "right", right: "left", forward: "backward", backward: "forward" };
export const BAL_PUSH = 0.05;      // 每 tick(50ms)慣性把 pos 往 push 方向推(=1.0/秒)
export const BAL_COUNTER = 0.09;   // 抵抗時往回拉(=1.8/秒;比推力大,但持續按會過頭 → 要一收一放)
export const BAL_DEADZONE = 0.34;  // |pos| 在此範圍內 = 維持在中心 = 平衡中
export const BAL_CLAMP = 1.25;     // pos 上下限

// BOSS 戰(見 BOSS-BALANCE-SPEC.md):彈幕消除,判定換算雙向傷害
export const DMG_TABLE = { perfect: 1.0, great: 0.6, good: 0.3, miss: 0 };
export const SELF_DMG_TABLE = { perfect: 0, great: 0, good: 0.1, miss: 1.0 };
export const BOSS_HP = 100, PLAYER_HP = 100, BOSS_DMG_PER_HIT = 100 / 90, BOSS_SELF_DMG = 5;

export const JUDGE_LABEL = { perfect: "PERFECT", great: "GREAT", good: "GOOD", miss: "MISS" };

export const ITEM_DEFS = {
  headphone: { label: "降噪耳機", color: "#44E0D0", durationMs: 5000, cdMs: 12000 },
  sunglasses: { label: "墨鏡", color: "#8899AA", durationMs: 5000, cdMs: 12000 },
  clearcard: { label: "空車車票", color: "#C888FF", durationMs: 10000, cdMs: 20000 },
  express: { label: "共GO Express", color: "#FFD000", durationMs: 5000, cdMs: 30000 },  // 必殺技(集氣式)
};
export const EXPRESS_NEED = 100;              // 必殺技集滿所需能量(%)
// 每次成功判定累加的集氣量(miss 不倒扣;Perfect > Great > Good)
export const EXPRESS_GAIN = { perfect: 4.5, great: 2.8, good: 1.6 };

export const STAFF_DURATION_MS = 8000;
export const BACKPACK_SCORE = 300; // 驅散一位背包客
export const NOISE_SCORE = 20;     // 清除一顆雜訊

// 觸控裝置判斷:平衡事件的「方向按鈕提示」只在 PC 顯示(可按方向鍵);手機用傾斜,不顯示按鈕
export const IS_TOUCH = typeof window !== "undefined" && (("ontouchstart" in window) || ((navigator && navigator.maxTouchPoints) || 0) > 0);

// ── 震動 ──
// 原始碼是模組層級 `let VIBRATE_ON` 直接被主元件賦值(`VIBRATE_ON = s.vibrate !== false`)。
// ESM 不允許外部模組直接改另一個模組的 `let` 綁定,所以這裡改成 getter/setter,
// 呼叫端行為完全不變,只是要呼叫 `setVibrateOn(v)` 而不是直接賦值。
let vibrateOn = true;
export function isVibrateOn() { return vibrateOn; }
export function setVibrateOn(v) { vibrateOn = v; }
export function vibrate(pattern) {
  if (!vibrateOn) return;
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) { /* unsupported, ignore */ }
  }
}

// BOSS 死亡消散:預先算好碎片飛散方向
export const BOSS_SHARDS = Array.from({ length: 12 }, () => {
  const a = Math.random() * Math.PI * 2, r = 110 + Math.random() * 130;
  return { left: `${44 + Math.random() * 12}%`, top: `${18 + Math.random() * 22}%`, sx: `${Math.cos(a) * r}px`, sy: `${Math.sin(a) * r}px`, d: `${Math.random() * 0.2}s` };
});
export const SPLASH_LED = ["今日路線 · RUBY EXPRESS", "列車準點 · 尖峰時段", "嗶卡進站 · 節奏出發"];
export const SPLASH_FX = Array.from({ length: 9 }, (_, i) => ({ g: ["♪", "♩", "✦", "•", "✧"][i % 5], left: (8 + Math.random() * 84) + "%", top: (30 + Math.random() * 50) + "%", dur: (3 + Math.random() * 3) + "s", delay: (Math.random() * 3) + "s" }));
