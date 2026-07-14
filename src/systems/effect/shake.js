// Screen Shake 資料模型(打擊感基礎建設)。跟 FxManager 一樣,先建立獨立可測試的
// 模型,實際「畫面真的抖動」要等 Judge/Game Loop 恢復處理、把 judgeLane 命中
// 事件接到這裡的 trigger() 才會生效;Phase 6(Camera 演出系統)之後也會共用
// 這個模型做 BOSS 登場等演出震動,不用另外重做一套。
//
// 原理:trigger() 記錄「這次震動的強度/持續時間/開始時間」,getOffset(now)
// 依經過時間算衰減後的隨機位移量,呼叫端把回傳的 {x,y,rotate} 疊到畫面容器
// 的 CSS transform 上即可,本身不碰任何 DOM。
export class ScreenShake {
  constructor() {
    this._intensity = 0;
    this._durationMs = 0;
    this._startAt = 0;
  }

  // intensity:像素強度(建議 2~4 輕微、8~14 中等、20+ 重擊/BOSS 演出)。
  trigger(intensity, durationMs = 300, now = Date.now()) {
    // 只有新的震動比目前殘留的更強,或舊的已經播完,才覆蓋——避免弱特效打斷強震動。
    const remaining = this._startAt + this._durationMs - now;
    if (remaining > 0 && intensity < this._intensity) return;
    this._intensity = intensity;
    this._durationMs = durationMs;
    this._startAt = now;
  }

  isActive(now = Date.now()) {
    return now < this._startAt + this._durationMs;
  }

  // 回傳目前這一刻的位移量(線性衰減到 0)。
  getOffset(now = Date.now()) {
    if (!this.isActive(now)) return { x: 0, y: 0, rotate: 0 };
    const elapsed = now - this._startAt;
    const decay = 1 - elapsed / this._durationMs; // 1 → 0
    const mag = this._intensity * decay;
    // 用時間當 seed 的簡單偽隨機(避免每次都要傳 RNG 進來),同一 ms 內結果穩定。
    const rand = (seed) => (Math.sin(seed) * 10000) % 1;
    const x = (rand(now * 0.013) - 0.5) * 2 * mag;
    const y = (rand(now * 0.017 + 7) - 0.5) * 2 * mag;
    const rotate = (rand(now * 0.011 + 13) - 0.5) * 2 * (mag * 0.15);
    return { x, y, rotate };
  }
}

export function createScreenShake() {
  return new ScreenShake();
}
