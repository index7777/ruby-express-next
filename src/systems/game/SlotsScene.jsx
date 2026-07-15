// SlotsScene —— 對照原始碼 `phase==="slots"`(index.html 4527-4572 行)
// 選擇存檔畫面:三個獨立通勤進度存檔格,各自顯示進度/最佳分數/已選肉鴿卡
// 摘要。選一格後把它設成 `save.activeSlot`(對照原始碼 `selectSlot()`),
// 進入通勤路線圖(`stagemap`)。
//
// ⚠️ 刻意簡化:原始碼每格還有「▶ 接續中途」(`session` 中途存檔,記錄
// 播到一半的曲目時間點)——這個場景接的是完整的一站一站流程,沒有做
// 「單曲中途暫停存檔續玩」這個更細的機制,選格一律從路線圖重新選站,
// 詳見 `game/README.md`。
import { useMemo, useState } from "react";
import { ART } from "../assets/index.js";
import { loadSave, writeSave, emptySlot } from "../save/index.js";
import { summarizeCards } from "../data/index.js";
import MenuLayout from "./MenuLayout.jsx";
import { Button } from "../ui/index.js";

export default function SlotsScene({ onSelectSlot, onBack }) {
  const [tick, setTick] = useState(0);
  const save = useMemo(() => loadSave(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSlot = (i) => {
    // 對照原始碼 selectSlot():把這格設成使用中格,routes.ruby 鏡像同步更新。
    save.activeSlot = i;
    save.routes = save.routes || {};
    save.routes.ruby = JSON.parse(JSON.stringify(save.slots[i].ruby));
    writeSave(save);
    onSelectSlot(i);
  };

  const deleteSlot = (i) => {
    if (typeof confirm !== "undefined" && !confirm(`確定清除存檔 ${i + 1} 的進度?`)) return;
    save.slots[i] = emptySlot();
    writeSave(save);
    setTick((t) => t + 1);
  };

  return (
    <MenuLayout title="選擇存檔" subtitle="SELECT SAVE · 三個獨立通勤進度" bg={ART.stagemapBg} onBack={onBack}>
      {[0, 1, 2].map((i) => {
        const sl = save.slots[i] || emptySlot();
        const done = (sl.ruby.stationCleared || []).filter(Boolean).length;
        const fresh = !sl.created && done === 0 && !sl.ruby.bossDefeated;
        const groups = summarizeCards((sl.run && sl.run.cards) || []);
        const total = groups.reduce((a, g) => a + g.count, 0);
        return (
          <div key={i} style={{
            padding: "12px 14px", borderRadius: 12, border: "1px solid #3A4450",
            background: "rgba(32,36,42,0.85)", display: "flex", flexDirection: "column", gap: 8,
          }}>
            <button
              onClick={() => selectSlot(i)}
              style={{ background: "none", border: "none", color: "inherit", textAlign: "left", cursor: "pointer", padding: 0 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <b style={{ fontSize: 14 }}>存檔 {i + 1}</b>
                {sl.ruby.bossDefeated && <span style={{ fontSize: 11, color: "#FFD43B" }}>★ 已通關</span>}
              </div>
              {fresh ? (
                <div style={{ fontSize: 12, opacity: 0.6 }}>＋ 新的通勤</div>
              ) : (
                <div style={{ fontSize: 11, opacity: 0.85, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>進度 {done}/5 站{sl.ruby.bossDefeated ? " · BOSS ✓" : ""}</span>
                  <span>最佳 {sl.best || 0} 分</span>
                  <span>肉鴿增益 ×{total}{groups.length ? "：" + groups.map((g) => g.card.name + (g.count > 1 ? ` ×${g.count}` : "")).join("、") : ""}</span>
                </div>
              )}
            </button>
            {!fresh && <Button variant="ghost" style={{ fontSize: 11, alignSelf: "flex-end" }} onClick={() => deleteSlot(i)}>清除</Button>}
          </div>
        );
      })}
    </MenuLayout>
  );
}
