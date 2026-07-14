// CAMERA_PRESETS —— 對照 camera/README.md「套用時機:BOSS 登場、BOSS 技能、
// Combo 里程碑、BOSS 死亡」寫的參考用法,不是強制 API,只是文件+方便呼叫端
// 一行套用。這裡完全沒有被任何畫面呼叫,純粹紀錄「這個效果原本設計起來要
// 怎麼用」,實際數值(強度/時長)之後接線試玩時大概率要調整。
import { CameraManager } from "./cameraManager.js";

export const CAMERA_PRESETS = {
  // BOSS 登場:鏡頭緩緩推近,停留在 1.15 倍,直到 bossEntranceEnd 或
  // reset() 之前都維持這個構圖。
  bossEntrance(camera, now = Date.now()) {
    camera.zoomTo(1.15, 900, "easeOut", now);
  },
  // BOSS 進場動畫結束、開始正式戰鬥:鏡頭退回正常構圖(不能影響判定手感,
  // 所以退回速度不能太慢)。
  bossEntranceEnd(camera, now = Date.now()) {
    camera.zoomTo(1, 400, "easeOut", now);
  },
  // BOSS 使用技能瞬間:短促的鏡頭猛推一下,馬上彈回。
  bossSkill(camera, now = Date.now()) {
    camera.punchZoom(0.06, 260, now);
  },
  // combo 里程碑(50/100/200/300):門檻越高衝擊越明顯,呼應
  // effect/fxManager.js 的 combo 視覺里程碑。
  comboMilestone(camera, tier, now = Date.now()) {
    const delta = tier >= 300 ? 0.1 : tier >= 200 ? 0.08 : tier >= 100 ? 0.06 : 0.04;
    camera.punchZoom(delta, 220, now);
  },
  // BOSS 死亡:慢動作 + 鏡頭猛推,子彈時間感。
  bossDeath(camera, now = Date.now()) {
    camera.slowMotion(0.25, 1400, now);
    camera.punchZoom(0.12, 400, now);
  },
};

/** @param {CameraManager} camera */
export function applyCameraPreset(camera, name, ...args) {
  const preset = CAMERA_PRESETS[name];
  if (!preset) throw new Error(`applyCameraPreset: 未知的 preset "${name}"`);
  return preset(camera, ...args);
}
