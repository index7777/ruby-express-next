// 搬自 web-build/index.html 第 250-293 行左右。逐字保留,行為不變。
export const ACHIEVEMENTS = [
  { id: "firstClear", name: "首次通勤", desc: "完成任一關卡", cond: (c) => c.completed },
  { id: "fullCombo", name: "一氣呵成", desc: "單場全連(零 Miss)", cond: (c) => c.fc },
  { id: "combo100", name: "一路綠燈", desc: "單場 COMBO ≥ 100", cond: (c) => c.maxCombo >= 100 },
  { id: "accS", name: "準點達人", desc: "單場評級 S", cond: (c) => c.rank === "S" },
  { id: "fiveStations", name: "紅寶線全線通", desc: "五站全部通過", cond: (c) => c.fiveStations },
  { id: "bossKill", name: "討伐上班族之怒", desc: "擊敗紅線 BOSS", cond: (c) => c.bossWin },
  { id: "noItemBoss", name: "徒手加班", desc: "不用任何道具擊敗 BOSS", cond: (c) => c.bossWin && !c.usedItem },
  { id: "ultKO", name: "共GO 一擊入魂", desc: "用必殺技終結 BOSS", cond: (c) => c.ultKO },
  { id: "commuter", name: "通勤常客", desc: "累積遊玩 20 場", cond: (c) => c.plays >= 20 },
];

// 每日任務池
export const DAILY_POOL = [
  { id: "d_perfect50", label: "今日累積 50 個 Perfect", target: 50, add: (c) => c.counts.perfect },
  { id: "d_boss1", label: "討伐 BOSS 一次", target: 1, add: (c) => (c.bossWin ? 1 : 0) },
  { id: "d_acc90", label: "單場準確率 ≥ 90%", target: 1, add: (c) => (c.acc >= 90 ? 1 : 0) },
  { id: "d_play3", label: "今日通勤 3 趟", target: 3, add: () => 1 },
  { id: "d_combo50", label: "單場 COMBO ≥ 50", target: 1, add: (c) => (c.maxCombo >= 50 ? 1 : 0) },
  { id: "d_nomiss", label: "單場零 Miss 完成", target: 1, add: (c) => (c.fc ? 1 : 0) },
];

function todayStr() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "0"; } }

// 依日期抽今日 3 項任務(不重複抽,同一天內固定)
export function rollDaily(save) {
  const t = todayStr();
  if (!save.daily || save.daily.date !== t) {
    const ids = DAILY_POOL.map((d) => d.id).sort(() => Math.random() - 0.5).slice(0, 3);
    save.daily = { date: t, taskIds: ids, progress: {}, doneIds: [] };
  }
  return save.daily;
}
