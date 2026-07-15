// ResultBreakdown —— 對照原始碼 `ResultStats` 元件(2026-07-14g 批次三
// 重新設計過的「四條各自獨立進度條」版本):Perfect/Great/Good/Miss 各自
// 一條色點 + 全名 + 比例%,共用給 ResultScene/BossResultScene。
import { ProgressBar } from "../ui/index.js";

const ROWS = [
  { key: "perfect", label: "Perfect", color: "#FFD700" },
  { key: "great", label: "Great", color: "#3FE0FF" },
  { key: "good", label: "Good", color: "#7CFFB0" },
  { key: "miss", label: "Miss", color: "#FF6A6A" },
];

export default function ResultBreakdown({ counts }) {
  const total = counts.perfect + counts.great + counts.good + counts.miss || 1;
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
      {ROWS.map((r) => {
        const n = counts[r.key] || 0;
        return (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, width: 52, flexShrink: 0 }}>{r.label}</span>
            <div style={{ flex: 1 }}><ProgressBar value={n / total} color={r.color} height={6} /></div>
            <span style={{ fontSize: 11, width: 30, textAlign: "right", flexShrink: 0 }}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}
