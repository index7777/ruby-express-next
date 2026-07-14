import { createCameraManager } from "./src/systems/camera/cameraManager.js";
import { CAMERA_PRESETS, applyCameraPreset } from "./src/systems/camera/presets.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}
function near(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

// 初始狀態:中性(zoom=1, pan=0,0, timeScale=1)
{
  const cam = createCameraManager();
  const s = cam.getState(0);
  assert(s.zoom === 1 && s.x === 0 && s.y === 0 && s.timeScale === 1, "初始狀態為中性值");
}

// zoomTo:tween 插值 + 播完停在目標值
{
  const cam = createCameraManager();
  cam.zoomTo(2, 1000, "linear", 0);
  assert(near(cam.getZoom(0), 1), "zoomTo 剛觸發時還在起點");
  assert(near(cam.getZoom(500), 1.5), "zoomTo 線性 easing 中點應為起訖平均值");
  assert(near(cam.getZoom(1000), 2), "zoomTo 播完剛好等於目標值");
  assert(near(cam.getZoom(5000), 2), "zoomTo 播完後停在目標值,不會繼續變化");
}

// zoomTo 連續呼叫:新 tween 的 from 是呼叫當下的插值結果,不是跳回舊起點
{
  const cam = createCameraManager();
  cam.zoomTo(2, 1000, "linear", 0);
  cam.zoomTo(1, 1000, "linear", 500); // 500ms 時 zoom=1.5,從這裡開始退回 1
  assert(near(cam.getZoom(500), 1.5), "中途換目標,起點是當下的插值結果");
  assert(near(cam.getZoom(1000), 1.25), "中途換目標後的線性插值中點正確");
  assert(near(cam.getZoom(1500), 1), "中途換目標後仍會準時到達新目標值");
}

// punchZoom:一次性衝擊,線性衰減回 0,疊加在 zoomTo 的基準值上
{
  const cam = createCameraManager();
  cam.punchZoom(0.2, 200, 0);
  assert(near(cam.getZoom(0), 1.2), "punchZoom 剛觸發時疊加完整強度");
  assert(near(cam.getZoom(100), 1.1), "punchZoom 中途衰減到一半");
  assert(near(cam.getZoom(200), 1), "punchZoom 播完後完全消失,回到基準值");

  // 更強的衝擊會覆蓋還沒播完的弱衝擊
  cam.punchZoom(0.05, 500, 1000);
  cam.punchZoom(0.3, 500, 1050); // 更強,應該覆蓋
  assert(near(cam.getZoom(1050), 1.3), "更強的 punchZoom 會覆蓋還沒播完的弱衝擊");

  // 更弱的衝擊不會打斷還沒播完的強衝擊
  cam.punchZoom(0.3, 500, 2000);
  cam.punchZoom(0.05, 500, 2100); // 更弱,不該覆蓋
  assert(near(cam.getZoom(2100), 1 + 0.3 * (1 - 100 / 500)), "更弱的 punchZoom 不會打斷還沒播完的強衝擊");
}

// panTo:插值 + 連續呼叫時 from 為當下插值結果
{
  const cam = createCameraManager();
  cam.panTo(100, -50, 1000, "linear", 0);
  const mid = cam.getPan(500);
  assert(near(mid.x, 50) && near(mid.y, -25), "panTo 線性插值中點正確");
  const end = cam.getPan(1000);
  assert(near(end.x, 100) && near(end.y, -50), "panTo 播完停在目標值");
}

// focusOn 目前是 panTo 的別名
{
  const cam = createCameraManager();
  cam.focusOn(30, 40, 200, "linear", 0);
  const end = cam.getPan(200);
  assert(near(end.x, 30) && near(end.y, 40), "focusOn 目前等同 panTo(x, y)");
}

// slowMotion:線性回到 1,更慢的優先
{
  const cam = createCameraManager();
  cam.slowMotion(0.25, 1000, 0);
  assert(near(cam.getTimeScale(0), 0.25), "slowMotion 剛觸發時是設定的 scale");
  assert(near(cam.getTimeScale(500), 0.625), "slowMotion 中途線性回升到中間值");
  assert(near(cam.getTimeScale(1000), 1), "slowMotion 播完回到正常速度 1");
  assert(cam.isSlowMotionActive(500) === true, "isSlowMotionActive 在期間內為 true");
  assert(cam.isSlowMotionActive(1000) === false, "isSlowMotionActive 播完後為 false");

  cam.slowMotion(0.5, 500, 2000);
  cam.slowMotion(0.8, 500, 2100); // 比較不慢,不該打斷正在播的更慢效果
  assert(cam.getTimeScale(2100) < 0.8, "較不慢的 slowMotion 不會打斷還在播的更慢效果");
}

// reset():回到中性狀態
{
  const cam = createCameraManager();
  cam.zoomTo(2, 100, "linear", 0);
  cam.panTo(50, 50, 100, "linear", 0);
  cam.punchZoom(0.5, 1000, 0);
  cam.slowMotion(0.2, 1000, 0);
  cam.reset(50);
  const s = cam.getState(50);
  assert(s.zoom === 1 && s.x === 0 && s.y === 0 && s.timeScale === 1, "reset() 後所有數值回到中性");
}

// CAMERA_PRESETS / applyCameraPreset
{
  const cam = createCameraManager();
  assert(typeof CAMERA_PRESETS.bossEntrance === "function", "CAMERA_PRESETS 含 bossEntrance");
  assert(typeof CAMERA_PRESETS.comboMilestone === "function", "CAMERA_PRESETS 含 comboMilestone");
  applyCameraPreset(cam, "bossEntrance", 0);
  assert(near(cam.getZoom(900), 1.15), "applyCameraPreset(bossEntrance) 900ms 後鏡頭到位");

  const cam2 = createCameraManager();
  let threw = false;
  try { applyCameraPreset(cam2, "not-a-real-preset"); } catch (e) { threw = true; }
  assert(threw, "applyCameraPreset 呼叫不存在的 preset 會丟錯");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
