// SceneManager —— 場景生命週期管理(新增系統,原始碼沒有這層)。
//
// 對照原始碼:`web-build/index.html` 目前用單一一個 `phase` state
// (`useState("splash")`)+ 一大堆 `setPhase("xxx")` 呼叫直接切換畫面,
// 分散在 20+ 個按鈕/函式裡(splash/hub/lobby/mode/slots/songselect/
// bossselect/stagemap/arrival/running/penalty/boss/result/calibrate/
// settings/records/news/leaderboard/vending,詳見 SCENE_NAMES 常數),
// 每次切換前後要做的事(例如 `stopBgm()`/`ensureAudio()`/重置某些 ref)
// 都要記得手動加在 setPhase 呼叫附近,容易漏掉或加錯地方。
//
// 這裡提供一個通用的 Enter/Update/Exit 生命週期管理器:每個場景註冊時
// 提供 onEnter/onUpdate/onExit 三個 callback,`goto(name)` 會自動依序
// 呼叫「離開現在的場景」→「進入新場景」,呼叫順序穩定、不會漏。
//
// 這是「先建立系統,還不接線」的階段(跟 Phase 2 Audio、Phase 4 FX 一樣的
// 模式):SceneManager 本身跟 React/DOM 完全無關,純粹管理「現在是哪個
// 場景、切換時該通知誰」,還沒有真的接進 web-build/index.html 的 20 個
// phase 分支。

// 原始碼目前已知的 phase 字串清單(僅供對照文件用,SceneManager 本身
// 不限制場景名稱一定要是這些值,註冊任何字串都可以)。
export const SCENE_NAMES = [
  "splash", "hub", "lobby", "mode", "slots", "songselect", "bossselect",
  "stagemap", "arrival", "running", "penalty", "boss", "result",
  "calibrate", "settings", "records", "news", "leaderboard", "vending",
];

function noop() {}

export class SceneManager {
  constructor() {
    this._scenes = new Map();
    this._current = null;
    this._history = [];
  }

  // 註冊一個場景。def = { onEnter(data), onUpdate(dt, data), onExit(data) },
  // 三個 callback 都是選填,沒提供的用 no-op。同名重複註冊會直接覆蓋
  // (方便 HMR/測試時重新定義,不會噴錯)。
  register(name, def = {}) {
    this._scenes.set(name, {
      onEnter: def.onEnter || noop,
      onUpdate: def.onUpdate || noop,
      onExit: def.onExit || noop,
    });
    return this;
  }

  has(name) {
    return this._scenes.has(name);
  }

  getCurrent() {
    return this._current;
  }

  getHistory() {
    return this._history.slice();
  }

  // 切換到 name 場景:目前場景(若有)先 onExit(data),再對 name 呼叫
  // onEnter(data)。預設會把「離開的場景」推進 history,給 back() 用;
  // options.remember=false 可以跳過(例如登入頁這種不希望被 back 回去
  // 的場景)。options.force=true 時,即使 name 就是目前場景也會重新跑
  // 一次 exit+enter(原始碼有些按鈕會這樣用,例如同一頁的「重新挑戰」)。
  goto(name, data, options = {}) {
    const { remember = true, force = false } = options;
    if (!this.has(name)) {
      throw new Error(`SceneManager: 場景 "${name}" 尚未註冊,請先呼叫 register()`);
    }
    if (this._current === name && !force) {
      return this._current; // 同一場景、非強制:視為 no-op,不重複觸發生命週期
    }
    const prevName = this._current;
    if (prevName != null) {
      const prevScene = this._scenes.get(prevName);
      prevScene.onExit(data);
      if (remember) this._history.push(prevName);
    }
    this._current = name;
    this._scenes.get(name).onEnter(data);
    return this._current;
  }

  // 回到上一個場景(history 堆疊 pop)。history 是空的話,退回 fallback
  // (若有提供);都沒有就維持現狀不動。原始碼本身沒有真正的「上一頁」
  // 概念(每個返回按鈕都寫死目標 phase),這是額外提供的能力,用不用
  // 由接線那邊決定。
  back(data, fallback) {
    const prevName = this._history.pop();
    if (prevName == null) {
      if (fallback != null && this.has(fallback) && fallback !== this._current) {
        return this.goto(fallback, data, { remember: false });
      }
      return this._current;
    }
    const cur = this._current;
    if (cur != null) this._scenes.get(cur).onExit(data);
    this._current = prevName;
    this._scenes.get(prevName).onEnter(data);
    return this._current;
  }

  // 每幀呼叫,轉發給目前場景的 onUpdate。SceneManager 本身不跑
  // requestAnimationFrame 迴圈,由呼叫端(未來的 game loop)決定何時呼叫。
  update(dt, data) {
    if (this._current == null) return;
    this._scenes.get(this._current).onUpdate(dt, data);
  }

  // 清空 history(例如結算畫面回大廳,不希望「返回」還能回到剛打完的關卡)。
  clearHistory() {
    this._history = [];
  }
}

export function createSceneManager() {
  return new SceneManager();
}
