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

// evalRun ——对照原始碼 `evalRun(opts)`(1433-1460 行):結算一輪(不管是一般
// 行駛的一首歌播完,還是 BOSS 戰勝/敗)之後,檢查成就解鎖 + 推進每日任務
// 進度。這是 2026-07-15 之後才發現的缺口:`data/achievements.js` 一直只有
// `ACHIEVEMENTS`/`DAILY_POOL`/`rollDaily()` 這些「資料」,`RecordsScene.jsx`/
// `HubScene.jsx` 也都已經在讀 `save.achievements`/`save.daily` 準備顯示,
// 但整個專案沒有任何地方真的呼叫檢查/寫入——UI 骨架看起來像做完了,實際上
// 成就永遠鎖住、每日任務進度永遠 0。
//
// 純粹「讀 ctx、改 save 物件」的邏輯(對照原始碼直接改 `s.achievements`/
// `s.daily` 這兩個欄位),不碰 localStorage/toast UI——呼叫端(場景)自己
// `loadSave()`/`writeSave()`包起來,自己決定解鎖/達成提示要怎麼顯示(這個
// port 目前只有單顆 `notice` 文字,不是原始碼的多顆 `pushToast()` 疊加,
// 所以回傳解鎖清單讓呼叫端自己組字串,不在這裡寫死呈現方式)。
//
// ctx 形狀對照 `ACHIEVEMENTS`/`DAILY_POOL` 的 `cond`/`add` 需要讀的欄位,
// 逐字對照原始碼 `evalRun()` 組出來的 `ctx` 物件:
// { counts, maxCombo, acc, fc, rank, completed, bossWin, usedItem, ultKO,
//   fiveStations, plays }
export function evalRun(save, ctx) {
  if (!save.achievements) save.achievements = {};
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements[a.id] && a.cond(ctx)) {
      save.achievements[a.id] = true;
      unlocked.push(a);
    }
  }
  const daily = rollDaily(save);
  const completed = [];
  for (const id of daily.taskIds) {
    if (daily.doneIds.includes(id)) continue;
    const def = DAILY_POOL.find((x) => x.id === id);
    if (!def) continue;
    const inc = def.add(ctx) || 0;
    if (inc > 0) {
      daily.progress[id] = Math.min(def.target, (daily.progress[id] || 0) + inc);
      if (daily.progress[id] >= def.target) {
        daily.doneIds.push(id);
        completed.push(def);
      }
    }
  }
  return { unlocked, completed };
}
