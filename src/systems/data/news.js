// 搬自 web-build/index.html 第 270-285 行左右。逐字保留,行為不變。
// 公告(旅客資訊公告欄)fallback — 實際內容可維護 assets/announcements.json
export const DEFAULT_NEWS = [
  { date: "2026-07-07", tag: "更新", title: "紅寶線全線通車", body: "迴音淡水 → 潮汐紅樹 → 竹圍風動 → 關渡平原 → 嶺上清風,終點迎戰「上班族之怒」。" },
  { date: "2026-07-07", tag: "活動", title: "每日任務上線", body: "月台 LED 看板每天更新任務,完成拿成就,通勤更有動力!" },
];

// 營運看板(排行)fallback — 之後接後台/實際資料;先放假資料
export const DEFAULT_LEADERBOARD = [
  { name: "摸魚王", score: 128400, line: "紅寶線" },
  { name: "準時哥", score: 119250, line: "紅寶線" },
  { name: "咖啡因", score: 101800, line: "其它" },
  { name: "末班車", score: 98120, line: "紅寶線" },
  { name: "打卡鐘", score: 90540, line: "其它" },
  { name: "通勤俠", score: 82300, line: "紅寶線" },
  { name: "睏飽崙", score: 76110, line: "其它" },
  { name: "加班狗", score: 69800, line: "紅寶線" },
];
