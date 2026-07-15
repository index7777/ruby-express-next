// VendingScene —— 對照原始碼 `phase==="vending"`(index.html 4275-4315
// 行)自動販賣機:預購「加購月票」(120 點,下一場開場道具補滿)/「常客
// 優惠」(80 點,下一場進站補給 +1 種)。兩者都是「預購」,實際生效點
// (下一場開場/進站補給)留給 PlayScene/StageMapScene 之後接線消費
// `save.preorder`,這個畫面只負責扣點數 + 寫入預購旗標。
import { useMemo, useState } from "react";
import { ART } from "../assets/index.js";
import { loadSave, writeSave } from "../save/index.js";
import MenuLayout from "./MenuLayout.jsx";

const ITEMS = [
  { key: "monthlypass", cost: 120, name: "加購月票(預購)", desc: "下一場開場道具自動補滿" },
  { key: "loyalty", cost: 80, name: "常客優惠(預購)", desc: "下一場進站補給 +1 種" },
];

export default function VendingScene({ onBack }) {
  const [tick, setTick] = useState(0);
  const save = useMemo(() => loadSave(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const preorder = save.preorder || {};

  const buy = (item) => {
    if ((save.points || 0) < item.cost) {
      try { alert(`哩程不足(需 ${item.cost})`); } catch (e) {}
      return;
    }
    save.points = (save.points || 0) - item.cost;
    save.preorder = save.preorder || {};
    save.preorder[item.key] = true;
    writeSave(save);
    try { alert(`已預購「${item.name}」`); } catch (e) {}
    setTick((t) => t + 1);
  };

  return (
    <MenuLayout title="自動販賣機" bg={ART.vending?.bg || ART.lobbyBg} onBack={onBack}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFD43B" }}>🪙 目前哩程:{(save.points || 0).toLocaleString()} 點</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ITEMS.map((item) => {
          const bought = preorder[item.key];
          return (
            <button
              key={item.key}
              disabled={bought}
              onClick={() => buy(item)}
              style={{
                padding: "14px 12px", borderRadius: 12, textAlign: "left", cursor: bought ? "default" : "pointer",
                border: `2px solid ${bought ? "#7CFFB0" : "#3FE0FF"}`, background: "rgba(20,22,26,0.6)", color: "inherit",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}{bought ? " ✓" : ""}</div>
              <div style={{ fontSize: 12, opacity: 0.8, margin: "4px 0" }}>{item.desc}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: bought ? "#7CFFB0" : "#FFD43B" }}>
                {bought ? "已預購" : `${item.cost} 點`}
              </div>
            </button>
          );
        })}
      </div>
    </MenuLayout>
  );
}
