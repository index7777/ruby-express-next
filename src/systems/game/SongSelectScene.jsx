// SongSelectScene —— 對照原始碼「自由模式」選曲畫面(songselect phase,
// 2779-2830/4634-4657 行)。原始碼這個畫面本身很單純:一份平面歌曲清單
// (▶ 選中 / ♪ 未選中的圖示 + 曲名),點一首只是切換選中狀態跟播放試聽,
// 真正進遊戲要另外按「共GO」按鈕——這裡逐字對照這個互動流程,不是自己
// 發明新設計。
//
// 跟 `StageMapScene.jsx`(通勤模式 5 站地圖)刻意分開:原始碼這兩個畫面
// 本來就是完全不同的兩條路徑(`mode` 畫面的「自由模式」卡片 vs
// 「通勤模式」卡片各自導向不同畫面),資料來源也不同(`DEFAULT_TRACKS`
// 平面清單 vs `REDLINE_TRACKS` 5 站固定曲目 + 站點過關狀態)。
//
// ⚠️ 刻意的範圍邊界:
// - 沒有接 `assets/songs.json` 動態曲目清單(原始碼執行期 fetch 這份清單,
//   讀不到才退回 `DEFAULT_TRACKS`;這裡直接固定用 `DEFAULT_TRACKS`,動態
//   清單牽涉到额外的 fetch/歌曲檔案管理,留到之後評估)。
// - 沒有真的試聽播放(原始碼點一首會用 `new Audio(file)` 循環播放
//   0.7 音量試聽,這裡只是視覺上標記選中,試聽音效留到接線階段一起做,
//   避免這輪同時處理太多音訊播放的邊界情況)。
import { useState } from "react";
import { DEFAULT_TRACKS } from "../data/index.js";
import { Button, Card } from "../ui/index.js";

export default function SongSelectScene({ onConfirm, onBack }) {
  const [selected, setSelected] = useState(0);

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0D10", color: "#8FE0FF",
      fontFamily: "-apple-system, system-ui, sans-serif", padding: 20,
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>自由模式 · 選曲</div>
          <Button variant="ghost" onClick={onBack}>返回</Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {DEFAULT_TRACKS.map((track, i) => (
            <Card key={track.name} active={selected === i} onClick={() => setSelected(i)}>
              <span style={{ fontSize: 16 }}>{selected === i ? "▶" : "♪"}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{track.name}</span>
            </Card>
          ))}
        </div>

        <Button variant="primary" style={{ width: "100%" }} onClick={() => onConfirm(DEFAULT_TRACKS[selected])}>
          ▶ 共GO
        </Button>
      </div>
    </div>
  );
}
