// StageMapScene —— 對照原始碼「通勤模式」5 站地圖(stagemap phase,
// 4596-4629 行)。跟 `SongSelectScene.jsx`(自由模式平面清單)刻意分開:
// 這裡的曲目固定用 `REDLINE_TRACKS`(紅寶線 5 站專屬曲目,索引跟
// `STATION_NAMES`/`stationCleared`/`stationBest` 一一對應),而且真的有
// 「過關才能選下一站」的鎖定狀態(靠 `save/save.js` 的 `isStationUnlocked()`
// 判斷),不是 `SongSelectScene` 那種隨便選的平面清單。
//
// ⚠️ 刻意的範圍邊界:
// - 只做「選站」這一層——原始碼選站後還有 `arrival`(進站小遊戲/肉鴿卡
//   三選一)才會真的進 `running`,這裡選了站直接進 `PlayScene`(對照
//   `PlayScene.jsx` 本來就寫明的範圍邊界:沒有肉鴿卡/道具/平衡對抗)。
// - 沒有顯示路線圖的視覺化站點連線/BOSS 站(原始碼在最後一站之後還有
//   BOSS 對戰入口),這裡只列 5 站,BOSS 對戰場另外從 `App.jsx` 直接進。
import { Button, Card } from "../ui/index.js";
import { STATION_NAMES, STATION_EN, REDLINE_TRACKS } from "../data/index.js";
import { loadSave, isStationUnlocked } from "../save/index.js";

export default function StageMapScene({ onSelectStation, onBack }) {
  const save = loadSave();
  const ruby = save.routes.ruby;

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0D10", color: "#8FE0FF",
      fontFamily: "-apple-system, system-ui, sans-serif", padding: 20,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>紅寶線 · 通勤路線圖</div>
          <Button variant="ghost" onClick={onBack}>返回</Button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>Ruby Line</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STATION_NAMES.map((name, i) => {
            const unlocked = isStationUnlocked(save, i);
            const cleared = !!ruby.stationCleared[i];
            const best = ruby.stationBest[i];
            return (
              <Card
                key={name}
                accentColor={cleared ? "#59E38C" : "#E63946"}
                active={cleared}
                onClick={unlocked ? () => onSelectStation(i, REDLINE_TRACKS[i]) : undefined}
                style={{ opacity: unlocked ? 1 : 0.4, cursor: unlocked ? "pointer" : "not-allowed", flexDirection: "column", alignItems: "flex-start", gap: 2 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>第 {i + 1} 站 · {name}</span>
                  {!unlocked && <span style={{ fontSize: 12 }}>🔒</span>}
                  {cleared && <span style={{ fontSize: 12 }}>✓</span>}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{STATION_EN[i]}</div>
                {cleared && <div style={{ fontSize: 11, opacity: 0.8 }}>最佳分數 {best}</div>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
