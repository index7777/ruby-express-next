import { COLORS, RADIUS, SHADOW, SPACING, FONT, TRANSITION, PRESS_SCALE } from "./src/systems/ui/tokens.js";
import { clamp01, stabilityColor, progressColor } from "./src/systems/ui/utils.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}

// tokens 結構完整性:每個群組都存在,且是預期的型別
{
  assert(typeof COLORS === "object" && COLORS !== null, "COLORS 是物件");
  assert(typeof COLORS.accent === "string" && COLORS.accent.startsWith("#"), "COLORS.accent 是 hex 字串");
  assert(typeof COLORS.danger === "string", "COLORS.danger 存在");
  assert(typeof RADIUS.md === "number" && RADIUS.md === 12, "RADIUS.md 對照原始碼最常見圓角 12");
  assert(typeof SHADOW.buttonPrimary === "string" && SHADOW.buttonPrimary.includes(COLORS.accentShadow), "SHADOW.buttonPrimary 引用 accentShadow 色號");
  assert(typeof SHADOW.glow === "function" && SHADOW.glow("#fff").includes("#fff"), "SHADOW.glow() 是可傳色號的 helper");
  assert(typeof SPACING.md === "number", "SPACING.md 存在");
  assert(FONT.family.includes("Segoe UI"), "FONT.family 對照 styles.page 的字體設定");
  assert(FONT.mono.includes("Courier New"), "FONT.mono 對照 splashLed 的等寬字體");
  assert(typeof TRANSITION.press === "string", "TRANSITION.press 存在");
  assert(PRESS_SCALE === 0.95, "PRESS_SCALE 對照 resultBtnPressed 的 scale(0.95)");
}

// clamp01:超出範圍的輸入都會被夾住
{
  assert(clamp01(0.5) === 0.5, "clamp01 範圍內原值不變");
  assert(clamp01(-1) === 0, "clamp01 負數夾到 0");
  assert(clamp01(2) === 1, "clamp01 超過 1 夾到 1");
  assert(clamp01(NaN) === 0, "clamp01 對 NaN 安全回傳 0(避免 width: NaN% 這種畫面錯誤)");
}

// stabilityColor:逐字對照原始碼 3764 行的三段閾值
{
  assert(stabilityColor(0) === "#FF2222", "stability=0 危險紅");
  assert(stabilityColor(10) === "#FF2222", "stability=10(閾值本身)仍是危險紅");
  assert(stabilityColor(11) === "#E63946", "stability=11 進入警戒橘紅");
  assert(stabilityColor(30) === "#E63946", "stability=30(閾值本身)仍是警戒橘紅");
  assert(stabilityColor(31) === "#36D367", "stability=31 進入安全綠");
  assert(stabilityColor(100) === "#36D367", "stability=100 安全綠");
}

// progressColor:0~1 比例版本,三段式配色跟 stabilityColor 概念一致
{
  assert(progressColor(0.05) === COLORS.danger, "ratio<=0.1 用 danger 色");
  assert(progressColor(0.2) === COLORS.ember, "ratio<=0.3 用 ember 色");
  assert(progressColor(0.9) === COLORS.success, "ratio>0.3 用 success 色");
  assert(progressColor(-1) === COLORS.danger, "progressColor 對超出範圍的輸入內部先 clamp01,不會噴錯");
  assert(progressColor(5) === COLORS.success, "progressColor 對超過 1 的輸入內部先 clamp01");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
