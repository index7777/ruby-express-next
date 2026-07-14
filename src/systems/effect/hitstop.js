// Hit Stop 資料模型(打擊感基礎建設):強力命中/技能發動時短暫「凍結一瞬間」
// 再繼續,是音樂/動作遊戲常見的打擊感手法。原始碼目前沒有這個效果。
//
// 這裡只提供「現在是否該凍結」的判斷(isActive/remaining),真正暫停 tick
// 迴圈前進(beatClockRef 停止累加)要等 Judge/Game Loop 恢復處理時才能接線,
// 因為 tick 迴圈本身就是那塊高風險核心的一部分。
export class HitStop {
  constructor() {
    this._until = 0;
  }

  // durationMs 建議:Perfect 命中 40~60ms、Combo 里程碑 80~120ms、
  // BOSS 大招/處決 150~250ms。數值僅為建議起點,實際手感需要你本機試玩調整。
  trigger(durationMs, now = Date.now()) {
    this._until = Math.max(this._until, now + durationMs);
  }

  isActive(now = Date.now()) {
    return now < this._until;
  }

  remaining(now = Date.now()) {
    return Math.max(0, this._until - now);
  }

  clear() {
    this._until = 0;
  }
}

export function createHitStop() {
  return new HitStop();
}
