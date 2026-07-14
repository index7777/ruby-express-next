// CameraManager —— 非 3D 的「演出相機」(新增系統,原始碼沒有這層)。
//
// 對照原始碼:原本畫面完全沒有鏡頭概念,BOSS 登場/技能/combo 里程碑/BOSS
// 死亡這些「加強演出張力」的時刻只能靠既有的 CSS class 切換(閃爍/抖動)
// 硬做。這裡提供統一的 zoom/pan/focus/slow-motion 原語,套用時機一律是
// README 說的「BOSS 登場、BOSS 技能、Combo 里程碑、BOSS 死亡」,規則是
// 「平常遊戲畫面保持穩定,相機效果不能影響判定手感」——所以這裡刻意只算
// 「畫面該怎麼呈現」的數字(zoom/pan/timeScale),不碰任何判定邏輯,
// `timeScale` 只是算出來的建議值,要不要真的拿去減速 tick 迴圈是接線階段
// 的決定,GameEngine 目前完全不知道這個系統存在。
//
// 跟 Phase 4 `effect/shake.js`(ScreenShake)共用同一套設計精神:
// - 一次性「衝擊後衰減」(punchZoom/slowMotion)沿用 ScreenShake 的
//   「更強的衝擊蓋掉還沒播完的舊衝擊」規則,避免弱特效打斷正在演出的強特效。
// - 持續性「移動到某個新的靜止值」(zoomTo/panTo)則是新的 tween 模型
//   (from→to,依經過時間 + 緩動曲線插值,播完就停在目標值)。
// - 兩者都是純數學:同一個 (state, now) 一定算出同一個結果,不碰 DOM/React。

export const EASINGS = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

function easingFn(name) {
  return EASINGS[name] || EASINGS.easeOut;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function tweenValueAt(tween, now) {
  const t = clamp01((now - tween.startAt) / tween.durationMs);
  const eased = easingFn(tween.easing)(t);
  return tween.from + (tween.to - tween.from) * eased;
}

function panTweenValueAt(tween, now) {
  const t = clamp01((now - tween.startAt) / tween.durationMs);
  const eased = easingFn(tween.easing)(t);
  return {
    x: tween.from.x + (tween.to.x - tween.from.x) * eased,
    y: tween.from.y + (tween.to.y - tween.from.y) * eased,
  };
}

// 一次性衝擊,線性衰減回 0(跟 ScreenShake.getOffset 的衰減公式一致)。
function decayToZero(shot, now) {
  if (!shot) return 0;
  const t = now - shot.startAt;
  if (t >= shot.durationMs) return 0;
  const remain = 1 - t / shot.durationMs;
  return shot.delta * remain;
}

export class CameraManager {
  constructor() {
    this._zoomTween = { from: 1, to: 1, startAt: 0, durationMs: 1, easing: "linear" };
    this._panTween = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, startAt: 0, durationMs: 1, easing: "linear" };
    this._zoomPunch = null; // { delta, startAt, durationMs }
    this._slowMo = null;    // { scale, startAt, durationMs }
  }

  // 持續性:把 zoom 移到新的靜止值(例如 BOSS 登場鏡頭推近到 1.15 倍並停留)。
  zoomTo(target, durationMs = 400, easing = "easeOut", now = Date.now()) {
    const from = tweenValueAt(this._zoomTween, now);
    this._zoomTween = { from, to: target, startAt: now, durationMs: Math.max(1, durationMs), easing };
  }

  // 一次性:短暫放大再衰減回目前的 zoomTo 目標值(例如 combo 里程碑的
  // 「鏡頭猛推一下」)。跟 ScreenShake 一樣,更強的衝擊不會被較弱的打斷。
  punchZoom(delta, durationMs = 220, now = Date.now()) {
    if (this._zoomPunch) {
      const remaining = this._zoomPunch.startAt + this._zoomPunch.durationMs - now;
      if (remaining > 0 && Math.abs(delta) < Math.abs(this._zoomPunch.delta)) return;
    }
    this._zoomPunch = { delta, startAt: now, durationMs };
  }

  getZoom(now = Date.now()) {
    return tweenValueAt(this._zoomTween, now) + decayToZero(this._zoomPunch, now);
  }

  // 持續性:把鏡頭平移到新的靜止位置。
  panTo(x, y, durationMs = 400, easing = "easeOut", now = Date.now()) {
    const from = panTweenValueAt(this._panTween, now);
    this._panTween = { from, to: { x, y }, startAt: now, durationMs: Math.max(1, durationMs), easing };
  }

  // focusOn:語意上是「把畫面對焦到某個點」,目前座標系統還沒有真正的世界
  // 座標(Scene 系統的畫面座標之後才會定案),先當 panTo 的別名,之後
  // Scene 接好世界座標時,這裡才會真的算「置中某個點所需的平移量」。
  focusOn(x, y, durationMs = 500, easing = "easeOut", now = Date.now()) {
    this.panTo(x, y, durationMs, easing, now);
  }

  getPan(now = Date.now()) {
    return panTweenValueAt(this._panTween, now);
  }

  // 一次性:短暫進入慢動作(scale 建議 0~1,1=正常速度,例如 0.25=四分之一
  // 速度),durationMs 內線性回到正常速度。更慢(scale 更小)的優先,不會
  // 被較不慢的打斷——用途例如 BOSS 死亡瞬間的子彈時間。
  slowMotion(scale, durationMs = 600, now = Date.now()) {
    if (this._slowMo) {
      const remaining = this._slowMo.startAt + this._slowMo.durationMs - now;
      if (remaining > 0 && scale > this._slowMo.scale) return;
    }
    this._slowMo = { scale, startAt: now, durationMs };
  }

  getTimeScale(now = Date.now()) {
    if (!this._slowMo) return 1;
    const t = now - this._slowMo.startAt;
    if (t >= this._slowMo.durationMs) return 1;
    const remain = t / this._slowMo.durationMs; // 0(剛觸發)→1(播完)
    return this._slowMo.scale + (1 - this._slowMo.scale) * remain;
  }

  isSlowMotionActive(now = Date.now()) {
    if (!this._slowMo) return false;
    return now - this._slowMo.startAt < this._slowMo.durationMs;
  }

  // 一次性把所有效果重設回中性狀態(zoom=1/pan=0,0/沒有 slowmo),
  // 例如離開 BOSS 戰回大廳時呼叫。
  reset(now = Date.now()) {
    this._zoomTween = { from: 1, to: 1, startAt: now, durationMs: 1, easing: "linear" };
    this._panTween = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, startAt: now, durationMs: 1, easing: "linear" };
    this._zoomPunch = null;
    this._slowMo = null;
  }

  // 給渲染端一次拿齊所有數值,方便組成一個 CSS transform 字串。
  getState(now = Date.now()) {
    const pan = this.getPan(now);
    return { zoom: this.getZoom(now), x: pan.x, y: pan.y, timeScale: this.getTimeScale(now) };
  }
}

export function createCameraManager() {
  return new CameraManager();
}
