import { createSceneManager, SCENE_NAMES } from "./src/systems/scene/sceneManager.js";

let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", label); }
}

// 場景名稱參考清單
assert(SCENE_NAMES.length >= 18, "SCENE_NAMES 涵蓋原始碼已知的 phase 清單");
assert(SCENE_NAMES.includes("splash") && SCENE_NAMES.includes("running") && SCENE_NAMES.includes("boss"), "SCENE_NAMES 含關鍵場景");

// 基本 register + goto + enter/exit 呼叫順序
{
  const log = [];
  const sm = createSceneManager();
  sm.register("splash", { onEnter: () => log.push("splash:enter"), onExit: () => log.push("splash:exit") });
  sm.register("hub", { onEnter: () => log.push("hub:enter"), onExit: () => log.push("hub:exit") });

  assert(sm.getCurrent() === null, "初始沒有目前場景");
  sm.goto("splash");
  assert(sm.getCurrent() === "splash", "goto 後目前場景正確");
  assert(JSON.stringify(log) === JSON.stringify(["splash:enter"]), "第一次 goto 只呼叫 enter,沒有 exit(沒有上一個場景)");

  sm.goto("hub");
  assert(sm.getCurrent() === "hub", "第二次 goto 切換到 hub");
  assert(JSON.stringify(log) === JSON.stringify(["splash:enter", "splash:exit", "hub:enter"]), "切換順序:先 exit 舊場景,再 enter 新場景");
}

// 未註冊場景要丟錯,不能靜默失敗
{
  const sm = createSceneManager();
  let threw = false;
  try { sm.goto("not-registered"); } catch (e) { threw = true; }
  assert(threw, "goto 未註冊場景會丟出錯誤");
}

// 同一場景重複 goto:預設視為 no-op,不重複觸發生命週期
{
  const log = [];
  const sm = createSceneManager();
  sm.register("hub", { onEnter: () => log.push("enter"), onExit: () => log.push("exit") });
  sm.goto("hub");
  sm.goto("hub");
  assert(JSON.stringify(log) === JSON.stringify(["enter"]), "重複 goto 同一場景不會重複觸發 enter/exit");

  // force:true 時要重新跑一次
  sm.goto("hub", null, { force: true });
  assert(JSON.stringify(log) === JSON.stringify(["enter", "exit", "enter"]), "force:true 允許重新進入同一場景(exit 再 enter)");
}

// data 會傳給 enter/exit —— 同一次 goto(name, data) 呼叫,data 會同時
// 傳給「被離開的舊場景」的 onExit 跟「被進入的新場景」的 onEnter。
{
  let receivedEnter = null, receivedExit = null;
  const sm = createSceneManager();
  sm.register("a", { onExit: (d) => { receivedExit = d; } });
  sm.register("b", { onEnter: (d) => { receivedEnter = d; } });
  sm.goto("a");
  sm.goto("b", { routeIdx: 2 });
  assert(JSON.stringify(receivedEnter) === JSON.stringify({ routeIdx: 2 }), "goto 的 data 會傳給新場景的 onEnter");
  assert(JSON.stringify(receivedExit) === JSON.stringify({ routeIdx: 2 }), "同一次 goto 的 data 也會傳給舊場景的 onExit");
}

// history / back()
{
  const log = [];
  const sm = createSceneManager();
  ["hub", "lobby", "mode", "songselect"].forEach((n) =>
    sm.register(n, { onEnter: () => log.push(n + ":enter"), onExit: () => log.push(n + ":exit") })
  );
  sm.goto("hub");
  sm.goto("lobby");
  sm.goto("mode");
  assert(JSON.stringify(sm.getHistory()) === JSON.stringify(["hub", "lobby"]), "history 依序記錄離開過的場景");

  log.length = 0;
  sm.back();
  assert(sm.getCurrent() === "lobby", "back() 回到 history 最上層(lobby)");
  assert(JSON.stringify(log) === JSON.stringify(["mode:exit", "lobby:enter"]), "back() 呼叫順序:先 exit 目前場景,再 enter 回去的場景");

  sm.back();
  assert(sm.getCurrent() === "hub", "back() 可以連續呼叫,一路退回 hub");

  log.length = 0;
  const cur = sm.back(); // history 已空,且沒給 fallback
  assert(cur === "hub", "history 清空後再呼叫 back() 且無 fallback 時維持現狀");
  assert(JSON.stringify(log) === JSON.stringify([]), "history 清空後 back() 不觸發任何 enter/exit");

  const cur2 = sm.back(null, "hub"); // fallback 剛好等於目前場景,不該重複觸發
  assert(cur2 === "hub", "fallback 等於目前場景時保持不變");
}

// remember:false 不進 history
{
  const sm = createSceneManager();
  ["settings", "hub"].forEach((n) => sm.register(n, {}));
  sm.goto("settings", null, { remember: false });
  assert(JSON.stringify(sm.getHistory()) === JSON.stringify([]), "remember:false 不會把場景推進 history");
}

// clearHistory
{
  const sm = createSceneManager();
  ["running", "result", "hub"].forEach((n) => sm.register(n, {}));
  sm.goto("running");
  sm.goto("result");
  assert(sm.getHistory().length === 1, "clearHistory 前 history 有內容");
  sm.clearHistory();
  assert(sm.getHistory().length === 0, "clearHistory 清空 history");
  sm.goto("hub");
  assert(sm.getHistory().length === 1, "clearHistory 後仍可正常繼續累積新的 history");
}

// update() 轉發給目前場景
{
  let received = null;
  const sm = createSceneManager();
  sm.register("running", { onUpdate: (dt, data) => { received = { dt, data }; } });
  sm.goto("running");
  sm.update(16.7, { score: 100 });
  assert(JSON.stringify(received) === JSON.stringify({ dt: 16.7, data: { score: 100 } }), "update() 把 dt/data 轉發給目前場景的 onUpdate");

  // 沒有目前場景時 update() 不應該丟錯
  const sm2 = createSceneManager();
  let threw = false;
  try { sm2.update(16.7); } catch (e) { threw = true; }
  assert(!threw, "沒有目前場景時呼叫 update() 不會丟錯");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
