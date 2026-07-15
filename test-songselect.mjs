import { defaultSave, isStationUnlocked, clearedProgress, loadSave, writeSave } from "./src/systems/save/index.js";
import { STATION_NAMES, REDLINE_TRACKS } from "./src/systems/data/index.js";
import { DEFAULT_TRACKS } from "./src/systems/data/songs.js";

// node 環境沒有 localStorage,用最簡單的記憶體版本模擬,才能測
// loadSave()/writeSave() 真正的讀寫來回(不是只測傳入的物件參照)。
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}

function saveWithCleared(clearedArr) {
  const save = defaultSave();
  save.routes.ruby.stationCleared = clearedArr;
  return save;
}

// 資料形狀:STATION_NAMES/REDLINE_TRACKS 一一對應(SongSelect/StageMap 場景的前提)
{
  assert(STATION_NAMES.length === 5, "STATION_NAMES 有 5 站");
  assert(REDLINE_TRACKS.length === 5, "REDLINE_TRACKS 對應 5 站曲目");
  assert(DEFAULT_TRACKS.length === 3, "DEFAULT_TRACKS(自由模式後備清單)有 3 首");
}

// isStationUnlocked:全新存檔只有第 0 站開放
{
  const save = defaultSave();
  assert(isStationUnlocked(save, 0) === true, "全新存檔第 0 站開放");
  assert(isStationUnlocked(save, 1) === false, "全新存檔第 1 站鎖定");
  assert(isStationUnlocked(save, 4) === false, "全新存檔第 4 站鎖定");
}

// isStationUnlocked:過關一站後,下一站解鎖
{
  const save = saveWithCleared([true, false, false, false, false]);
  assert(clearedProgress(save) === 1, "過第 0 站後 clearedProgress=1");
  assert(isStationUnlocked(save, 0) === true, "第 0 站仍開放");
  assert(isStationUnlocked(save, 1) === true, "過第 0 站後第 1 站解鎖");
  assert(isStationUnlocked(save, 2) === false, "第 2 站仍鎖定");
}

// isStationUnlocked:全部過關,5 站都開放
{
  const save = saveWithCleared([true, true, true, true, true]);
  assert(clearedProgress(save) === 5, "全過關 clearedProgress 上限 5");
  for (let i = 0; i < 5; i++) assert(isStationUnlocked(save, i) === true, `全過關後第 ${i} 站開放`);
}

// clearedProgress 既有行為(非嚴格連續,對照 save.js 既有實作,不是這次新增邏輯):
// 只看「最後一個 true 的索引 + 1」,不是真的檢查中間有沒有斷開。
{
  const save = saveWithCleared([true, false, true, false, false]);
  assert(clearedProgress(save) === 3, "既有 clearedProgress 行為:最後一個 true 在索引 2,回傳 3");
  assert(isStationUnlocked(save, 3) === true, "因此第 3 站也會被判定為解鎖(既有行為,非這次新增)");
}

// ⚠️ 2026-07-15p 修正的 bug 迴歸測試:寫存檔時只改 `save.routes.ruby`
// (鏡像欄位)不會真的持久化——`loadSave()` 只要 `slots` 陣列存在,就會
// 拿 `slots[activeSlot].ruby` 蓋掉 `routes.ruby`,所以真正該寫的是
// `save.slots[save.activeSlot].ruby`。這裡完整模擬 `PlayScene.jsx`
// 過關寫檔的那段邏輯,確認「寫入 → 重新 loadSave() → 讀到正確值」
// 這個完整來回是通的。
{
  localStorage.clear();
  // 第一次 writeSave() 之前,存檔還沒真的寫進 localStorage,`loadSave()`
  // 目前會直接回傳 `defaultSave()`(還沒有 `slots` 陣列存在於「已儲存的
  // 資料」裡,但 `defaultSave()` 本身就帶 3 個空存檔格)。
  let save = loadSave();
  assert(isStationUnlocked(save, 1) === false, "全新存檔第 1 站鎖定(尚未過關)");

  // 模擬 PlayScene.jsx 過關寫檔的正確寫法:寫 `slots[activeSlot].ruby`,
  // 同步鏡像欄位,再 writeSave()。
  const slotRuby = save.slots[save.activeSlot].ruby;
  slotRuby.stationCleared[0] = true;
  slotRuby.stationBest[0] = 1234;
  save.routes.ruby = JSON.parse(JSON.stringify(slotRuby));
  writeSave(save);

  // 重新 loadSave()(模擬離開再進 StageMapScene 重新掛載),確認真的讀得到。
  save = loadSave();
  assert(save.routes.ruby.stationCleared[0] === true, "重新 loadSave() 後第 0 站過關狀態有持久化");
  assert(save.routes.ruby.stationBest[0] === 1234, "重新 loadSave() 後最佳分數有持久化");
  assert(isStationUnlocked(save, 1) === true, "重新 loadSave() 後第 1 站解鎖了");
}

// 對照組:證明「只改 routes.ruby、不改 slots」確實會被下次 loadSave() 蓋掉
// (這就是曾經發生過的 bug,這裡刻意留著這個對照測試記錄下來)。
{
  localStorage.clear();
  let save = loadSave();
  save.routes.ruby.stationCleared[0] = true; // 錯誤寫法:只改鏡像欄位
  writeSave(save);
  save = loadSave();
  assert(save.routes.ruby.stationCleared[0] === false, "只改 routes.ruby 不改 slots 的寫法,下次 loadSave() 會被蓋回去(對照組,記錄曾經的 bug)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
