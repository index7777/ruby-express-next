// 搬自 web-build/index.html 第 372-399 行左右(肉鴿事件卡)。逐字保留,行為不變。
export const ROGUE_CARDS = [
  { id: "monthlypass", type: "buff", name: "加購月票", desc: "道具立即補滿", icon: "🎫" },
  { id: "quietcar",    type: "buff", name: "靜音車廂", desc: "降噪耳機持續時間 +50%", icon: "🎧" },
  { id: "shades",      type: "buff", name: "墨鏡達人", desc: "墨鏡減速時 Perfect 窗口 +30%", icon: "🕶️" },
  { id: "loyalty",     type: "buff", name: "常客優惠", desc: "進站補給 +1 種", icon: "🎁" },
  { id: "charge",      type: "buff", name: "集氣達人", desc: "必殺集氣 +25%", icon: "⚡" },
  { id: "ontime",      type: "buff", name: "準點通勤", desc: "穩定度不低於 30%", icon: "⏱️" },
  { id: "mrtspeed",    type: "buff", name: "捷運加速", desc: "分數 +15%", icon: "🚄" },
  { id: "aircon",      type: "buff", name: "冷氣超涼", desc: "Miss 穩定罰減半", icon: "❄️" },
  { id: "perfphone",   type: "buff", name: "完美耳機", desc: "Perfect 額外 +5 分", icon: "🎼" },
  { id: "boardfirst",  type: "buff", name: "先下後上", desc: "開場 12 秒自動 Perfect", icon: "🚪" },
  { id: "comborecover",type: "buff", name: "連擊回穩", desc: "Perfect 額外回 1 穩定(3s CD)", icon: "💚" },
  { id: "regenphone",  type: "buff", name: "再生耳機", desc: "每 15 秒補 1 次耳機充能", icon: "♻️" },
  { id: "priorityseat",type: "buff", name: "搶到博愛座", desc: "每 8 秒回 2 穩定度", icon: "💺" },
  { id: "announce",    type: "buff", name: "列車長廣播", desc: "進站多補 1 種道具", icon: "📢" },
  { id: "rushpay",     type: "deal", name: "尖峰加給", desc: "NPC +1,分數 ×1.3", icon: "💰" },
  { id: "punchin",     type: "deal", name: "用力打卡", desc: "Miss 罰加倍,Perfect +40%", icon: "👊" },
  { id: "doublebeat",  type: "deal", name: "雙倍節奏", desc: "音符 +25%,分數 +30%", icon: "🥁" },
  { id: "seathell",    type: "deal", name: "讓座地獄", desc: "分數 +30%,Miss 額外扣穩", icon: "😈" },
  { id: "finalsprint", type: "deal", name: "終點衝刺", desc: "BOSS 傷害 +30%,站間分 −15%", icon: "🏁" },
];
export const ROGUE_BY_ID = Object.fromEntries(ROGUE_CARDS.map((c) => [c.id, c]));

// 把已選卡 id 陣列(可能重複)整理成「去重 + 次數」給 UI 顯示
export function summarizeCards(ids) {
  const map = new Map();
  (ids || []).forEach((id) => { const card = ROGUE_BY_ID[id]; if (!card) return; const e = map.get(id) || { id, card, count: 0 }; e.count += 1; map.set(id, e); });
  return Array.from(map.values());
}
