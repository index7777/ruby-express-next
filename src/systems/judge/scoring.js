// 搬自 web-build/index.html 第 237-425 行左右的計分/評級/備援譜面產生邏輯。
// 這些是純函式(不吃 React state),Phase 1 提前搬過來;Judge 系統其餘部分
// (judgeLane/registerHit/getBeatTime 等跟 tick 迴圈綁在一起的邏輯)留到 Phase 3
// 才會跟 game loop 一起處理。

import { BASE_BPM, BEAT_SEC } from "../config/constants.js";

const START_DELAY = 1.8; // 跟 config/constants.js 的 START_DELAY 同值,buildChart 專用備援節奏

// 判定統計 → 準確率/評級(結算與成就共用)
// fullComboMiss(可選):譜面本身音符的 miss 次數(不含 NPC 攻擊音符,例如占位行李客雙軌音符)。
// 有傳入時 Full Combo(fc)改用這個數字判定;沒傳入(舊呼叫端)則沿用 counts.miss 當備援,行為不變。
export function accRank(counts, fullComboMiss) {
  const p = counts.perfect, g = counts.great, gd = counts.good, m = counts.miss;
  const total = p + g + gd + m;
  const acc = total ? (p * 100 + g * 60 + gd * 30) / (total * 100) * 100 : 0;
  const fcMissCount = typeof fullComboMiss === "number" ? fullComboMiss : m;
  const fc = fcMissCount === 0 && total > 0;
  const rank = (acc >= 95 && fc) ? "S" : acc >= 90 ? "A" : acc >= 75 ? "B" : "C";
  return { total, acc, fc, rank };
}

export function starRating(stability) {
  if (stability >= 90) return { star: 5, label: "特快專列" };
  if (stability >= 70) return { star: 4, label: "快速班次" };
  if (stability >= 50) return { star: 3, label: "正常準時" };
  if (stability >= 30) return { star: 2, label: "輕微晚點" };
  return { star: 1, label: "嚴重晚點" };
}

// 備援固定節奏(沒有 .normal.json 譜面的曲目用這個)
const PATTERN = [
  [0], [1], [2], [1], [0], [1], [2, 4], [1],
  [0], [1], [3], [1], [0], [1], [2], [4],
];

// ⚠️ 待確認:BASS_PATTERN / CHORD_ROOTS 搬自原檔第 405-406 行,原始碼裡完全沒有
// 其他地方引用(HANDOFF.md 也提到「原本程式合成的貝斯/和弦已關閉」),疑似死碼。
// 這裡先逐字保留、不刪除,確認真的用不到後可以移除。
const BASS_PATTERN = [130.81, 196, 130.81, 196, 174.61, 261.63, 174.61, 220, 146.83, 220, 146.83, 220, 196, 246.94, 196, 261.63];
const CHORD_ROOTS = [130.81, 174.61, 146.83, 196];

export function buildChart(cycles) {
  const chart = [];
  let step = 0;
  for (let c = 0; c < cycles; c++) {
    for (const lanes of PATTERN) {
      const hitTime = START_DELAY + step * BEAT_SEC;
      for (const lane of lanes) chart.push({ id: `${step}-${lane}`, lane, hitTime });
      step++;
    }
  }
  return chart;
}
