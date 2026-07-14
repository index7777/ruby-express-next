// 共用 Animation System(新增,原始碼沒有這層——各處效果各自手刻 setTimeout
// 秒數/CSS keyframe 名稱,同一種效果(例如「閃一下」)在不同地方(判定/NPC/
// 結算)時間長度常常不一致。這裡把常用的動畫「類型」統一定義成一份清單,
// 所有系統(UI/Boss/NPC/FX)共用同一份時間軸設定,不要各自定義。
//
// 用法:不是真的動畫引擎,是一份「規格表」——實際動畫還是用 CSS keyframes/
// transition 實作(跟現有專案風格一致),但時長/緩動曲線統一從這裡拿,
// 確保「動畫速度保持一致」。
export const ANIMATIONS = {
  fade:   { durationMs: 220, easing: "ease" },
  slide:  { durationMs: 260, easing: "ease-out" },
  zoom:   { durationMs: 240, easing: "ease-out" },
  bounce: { durationMs: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }, // overshoot
  shake:  { durationMs: 350, easing: "ease-in-out" },
  pulse:  { durationMs: 550, easing: "ease-in-out" },
  flash:  { durationMs: 220, easing: "ease-out" },
  rotate: { durationMs: 400, easing: "ease-in-out" },
  float:  { durationMs: 900, easing: "ease-in-out" },
};

export function getAnimation(name) {
  return ANIMATIONS[name] || ANIMATIONS.fade;
}
