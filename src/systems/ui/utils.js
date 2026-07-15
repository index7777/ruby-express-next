// utils —— UI 設計系統的純邏輯 helper(刻意獨立成 .js,不跟 .jsx 元件混在
// 一起——沙箱的 node 測試腳本沒有 JSX 轉譯器,只能 import 純 .js,這裡拆
// 出來才能被 `test-ui.mjs` 直接測試,這個拆分方式跟 `effect/animations.js`
// 、`particle/particleManager.js` 等其他系統把「純數學/純資料」跟渲染層
// (`.jsx`)分開的做法一致)。
import { COLORS } from "./tokens.js";

// clamp01:任何 ProgressBar 數值先夾在 0~1 之間,避免呼叫端傳超出範圍的
// 比例值時畫面出現超出容器的 fill 寬度或負寬度。
export function clamp01(ratio) {
  if (Number.isNaN(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

// stabilityColor:逐字對照原始碼 3764 行「穩定度數值 → 顏色」的三段閾值
// (<=10 危險紅 / <=30 警戒橘紅 / 其餘安全綠),`pct` 沿用原始碼 0~100 刻度
// 不是 0~1,呼叫端(ProgressBar 的 `variant="stability"`)直接照搬這個規則,
// 不是重新設計新的配色邏輯。
export function stabilityColor(pct) {
  if (pct <= 10) return "#FF2222";
  if (pct <= 30) return "#E63946";
  return "#36D367";
}

// progressColor:給不是「穩定度」這種特定語意、但一樣想要「數值越低越
// 危險」配色規則的通用 ProgressBar 用(例如之後接 BOSS 血條),沿用跟
// stabilityColor 同樣的三段式概念但改用 tokens 既有色票,`ratio` 是 0~1。
export function progressColor(ratio) {
  const r = clamp01(ratio);
  if (r <= 0.1) return COLORS.danger;
  if (r <= 0.3) return COLORS.ember;
  return COLORS.success;
}
