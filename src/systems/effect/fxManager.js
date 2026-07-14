// FX Library:統一管理一次性視覺特效(Perfect/Great/Good/Miss/Explosion/
// Shockwave/Smoke/Spark/Trail/Glow),取代原本每個效果各自寫一份
// `setTimeout(() => setXxx(...), 220)` 的樣板(例如原始碼的 addFloater/
// flashLane/emitLaneBurst,各自時間長度/清除邏輯都不太一樣)。
//
// 這是「先建立系統,還不接線」的階段:FxManager 本身跟畫面/React 完全無關,
// 純粹管理「目前有哪些特效正在播放、什麼時候該消失」,之後 Judge/Game Loop
// 恢復處理時,judgeLane/registerHit 呼叫 `fx.spawn(...)`,渲染端呼叫
// `fx.prune(now)` 取得目前該畫的清單,就能取代掉現有一堆各自獨立的
// floater/flash/spark state。

// 各類型預設持續時間(ms)——現在集中在這裡,以後要統一調整節奏只改一個地方。
export const FX_DURATIONS = {
  perfect: 260,
  great: 220,
  good: 180,
  miss: 300,
  explosion: 450,
  shockwave: 500,
  smoke: 600,
  spark: 350,
  trail: 400,
  glow: 500,
};

let seq = 0;
function nextId() { seq += 1; return `fx${seq}`; }

export class FxManager {
  constructor() {
    this._active = [];
  }

  // type 必須是 FX_DURATIONS 的 key 之一;data 是任意附加資訊(位置/顏色/軌道...)。
  // durationMs 可覆蓋預設值。回傳新特效的 id,方便呼叫端需要的話可以提前手動移除。
  spawn(type, data = {}, { now = Date.now(), durationMs } = {}) {
    const dur = typeof durationMs === "number" ? durationMs : (FX_DURATIONS[type] ?? 300);
    const inst = { id: nextId(), type, data, bornAt: now, expiresAt: now + dur };
    this._active.push(inst);
    return inst.id;
  }

  remove(id) {
    this._active = this._active.filter((f) => f.id !== id);
  }

  clear() {
    this._active = [];
  }

  // 清掉過期的特效,回傳目前還在播放的清單(給渲染端用)。
  prune(now = Date.now()) {
    this._active = this._active.filter((f) => f.expiresAt > now);
    return this._active;
  }

  getActive() {
    return this._active;
  }

  count() {
    return this._active.length;
  }
}

export function createFxManager() {
  return new FxManager();
}
