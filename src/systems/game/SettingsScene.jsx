// SettingsScene —— 對照原始碼 `phase==="settings"`(index.html 4376-4475
// 行)行控中心設定頁:音量/體感/平衡輸入方式/震動/乘客彈幕/判定校準/
// 自訂快捷鍵(電腦板)/玩家暱稱/玩法教學/清除存檔。
//
// ⚠️ 刻意簡化 / 範圍邊界:
// - 「體感傾斜」開關/平衡輸入「陀螺儀」選項只寫入設定值,沒有接真正的
//   `DeviceOrientationEvent` 讀取(那是手機板的體感事件,PlayScene/
//   BossScene 目前平衡對抗/傾斜都還沒實作,見 game/README.md)。
// - 自訂快捷鍵(`laneKeys`/`balanceKeys`)寫入 `save.settings`,但
//   `PlayScene.jsx`/`BossScene.jsx` 的判定邏輯目前仍固定讀 `KEY_TO_LANE`/
//   方向鍵,還沒有真的改讀這兩個自訂值——這裡先把「設定頁能不能換鍵」這
//   件事做完整,判定邏輯讀取自訂鍵留給下一輪接線,詳見 `config/constants.js`
//   開頭註解。
// - 「玩法教學」重看目前只是個 no-op 按鈕(教學關本身還沒搬進這個專案)。
import { useEffect, useMemo, useState } from "react";
import { ART } from "../assets/index.js";
import {
  LANES, IS_TOUCH, DEFAULT_LANE_KEYS, DEFAULT_BALANCE_KEYS, BALANCE_DIR_LABEL,
} from "../config/index.js";
import { loadSave, writeSave, defaultSave } from "../save/index.js";
import MenuLayout from "./MenuLayout.jsx";
import { Button } from "../ui/index.js";

export default function SettingsScene({ onEnterCalibrate, onBack }) {
  const [tick, setTick] = useState(0);
  const save = useMemo(() => loadSave(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const settings = save.settings;
  const [rebinding, setRebinding] = useState(null); // { type:"lane", index } | { type:"balance", dir }
  const [nameAsk, setNameAsk] = useState(false);
  const [nameInput, setNameInput] = useState(save.playerName || "");

  const setSetting = (key, val) => {
    save.settings = { ...save.settings, [key]: val };
    writeSave(save);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (!rebinding) return;
    const onKeyDown = (e) => {
      e.preventDefault();
      if (e.key === "Escape") { setRebinding(null); return; }
      if (rebinding.type === "lane") {
        const keys = settings.laneKeys.slice();
        if (keys.includes(e.key.toLowerCase()) && keys[rebinding.index] !== e.key.toLowerCase()) return; // 同組不能重複綁
        keys[rebinding.index] = e.key.toLowerCase();
        setSetting("laneKeys", keys);
      } else {
        const keys = { ...settings.balanceKeys };
        if (Object.values(keys).includes(e.key) && keys[rebinding.dir] !== e.key) return;
        keys[rebinding.dir] = e.key;
        setSetting("balanceKeys", keys);
      }
      setRebinding(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebinding]);

  const row = (label, control) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>{label}</span>
      {control}
    </div>
  );
  const toggleBtn = (on, onClick, labelOn = "開", labelOff = "關") => (
    <button
      onClick={onClick}
      style={{
        marginLeft: "auto", padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
        border: `1px solid ${on ? "#3FE0FF" : "#3A4450"}`,
        background: on ? "rgba(63,224,255,0.15)" : "transparent",
        color: on ? "#3FE0FF" : "#C0C8D0",
      }}
    >
      {on ? labelOn : labelOff}
    </button>
  );

  return (
    <MenuLayout title="設定" bg={ART.lobbyBg} onBack={onBack}>
      {row("音量", (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 200 }}>
          <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(e) => setSetting("volume", parseFloat(e.target.value))} style={{ flex: 1 }} />
          <b style={{ fontSize: 12, width: 38, textAlign: "right" }}>{Math.round(settings.volume * 100)}%</b>
        </div>
      ))}
      {row("體感傾斜", toggleBtn(settings.tilt, () => setSetting("tilt", !settings.tilt)))}
      {row("平衡對抗方式", (
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setSetting("balanceInput", "tilt")} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: "1px solid #3A4450", background: settings.balanceInput !== "keys" ? "rgba(63,224,255,0.15)" : "transparent", color: settings.balanceInput !== "keys" ? "#3FE0FF" : "#C0C8D0" }}>陀螺儀</button>
          <button onClick={() => setSetting("balanceInput", "keys")} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: "1px solid #3A4450", background: settings.balanceInput === "keys" ? "rgba(63,224,255,0.15)" : "transparent", color: settings.balanceInput === "keys" ? "#3FE0FF" : "#C0C8D0" }}>方向鍵</button>
        </div>
      ))}
      {row("震動", toggleBtn(settings.vibrate, () => setSetting("vibrate", !settings.vibrate)))}
      {row("乘客彈幕(車廂閒聊)", toggleBtn(!settings.danmakuOff, () => setSetting("danmakuOff", !settings.danmakuOff)))}
      {row("判定校準", (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 200 }}>
          <input type="range" min="-150" max="150" step="5" value={settings.offsetMs} onChange={(e) => setSetting("offsetMs", parseInt(e.target.value, 10))} style={{ flex: 1 }} />
          <b style={{ fontSize: 12, width: 44, textAlign: "right" }}>{settings.offsetMs > 0 ? "+" : ""}{settings.offsetMs}ms</b>
        </div>
      ))}

      <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>即時校準:進入後跟著掉落的音符點,系統自動量測你的延遲並套用</div>
        <Button variant="secondary" style={{ width: "100%" }} onClick={onEnterCalibrate}>進入即時校準</Button>
      </div>

      {!IS_TOUCH && (
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.8 }}>自訂快捷鍵(電腦板):點下面按鈕後按下想要的按鍵即可換綁,按 Esc 取消。</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LANES.map((lane, i) => {
              const active = rebinding && rebinding.type === "lane" && rebinding.index === i;
              return (
                <button key={lane.key} onClick={() => setRebinding({ type: "lane", index: i })} style={{ flex: "1 1 auto", padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: `1px solid ${active ? "#3FE0FF" : "#3A4450"}`, background: active ? "rgba(63,224,255,0.15)" : "transparent", color: active ? "#3FE0FF" : "#C0C8D0" }}>
                  {lane.label}:{active ? "按下新鍵…" : ` ${(settings.laneKeys[i] || lane.keyChar).toUpperCase()}`}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["forward", "backward", "left", "right"].map((dir) => {
              const active = rebinding && rebinding.type === "balance" && rebinding.dir === dir;
              const keyLabel = (settings.balanceKeys[dir] || DEFAULT_BALANCE_KEYS[dir]).replace("Arrow", "");
              return (
                <button key={dir} onClick={() => setRebinding({ type: "balance", dir })} style={{ flex: "1 1 auto", padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: `1px solid ${active ? "#3FE0FF" : "#3A4450"}`, background: active ? "rgba(63,224,255,0.15)" : "transparent", color: active ? "#3FE0FF" : "#C0C8D0" }}>
                  {BALANCE_DIR_LABEL[dir]}:{active ? "按下新鍵…" : ` ${keyLabel}`}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { setRebinding(null); setSetting("laneKeys", DEFAULT_LANE_KEYS.slice()); }}
            style={{ padding: "8px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", border: "1px solid #FF6A6A", color: "#FF6A6A", background: "transparent" }}
          >
            重設為預設(D/F/J/K/L + 方向鍵)
          </button>
        </div>
      )}

      {row("玩家暱稱", (
        <>
          <span style={{ flex: 1, textAlign: "right", fontWeight: 700, marginLeft: "auto" }}>{save.playerName || "—"}</span>
          <Button variant="ghost" style={{ marginLeft: 8, fontSize: 11 }} onClick={() => { setNameInput(save.playerName || ""); setNameAsk(true); }}>改名</Button>
        </>
      ))}
      {row("玩法教學", <Button variant="ghost" style={{ marginLeft: "auto", fontSize: 11 }} onClick={() => { try { alert("教學關尚未搬進這個重構專案"); } catch (e) {} }}>重看</Button>)}
      {row("清除存檔", (
        <button
          onClick={() => {
            if (typeof confirm !== "undefined" && !confirm("確定清除所有進度與成績?")) return;
            writeSave(defaultSave());
            setTick((t) => t + 1);
          }}
          style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: "1px solid #FF6A6A", color: "#FF6A6A", background: "transparent" }}
        >
          清除
        </button>
      ))}

      {nameAsk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#161A20", borderRadius: 14, padding: 20, width: 280, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>設定暱稱</div>
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value.slice(0, 12))} style={{ padding: 8, borderRadius: 8, border: "1px solid #3A4450", background: "#0D0F12", color: "#fff" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setNameAsk(false)}>取消</Button>
              <Button variant="primary" style={{ flex: 1 }} onClick={() => { save.playerName = nameInput.trim(); writeSave(save); setNameAsk(false); setTick((t) => t + 1); }}>確定</Button>
            </div>
          </div>
        </div>
      )}
    </MenuLayout>
  );
}
