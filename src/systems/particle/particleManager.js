// ParticleManager —— 真正的粒子模擬系統(新增系統,原始碼沒有這層)。
//
// 跟 `effect/fxManager.js` 的分工不同:FxManager 管理的是「一則浮動標籤/
// 固定圖層特效」(PERFECT 文字、爆炸貼圖疊層…),本身沒有物理位移;這裡的
// ParticleManager 管理的是「一大群各自有獨立速度/重力/摩擦力、會真的飛
// 出去再落下/消散」的粒子點,適合 combo 里程碑噴發、爆炸碎屑、Express
// 必殺衝刺拖尾這類需要「physically simulated」質感的畫面。兩者刻意分開,
// 呼叫端需要哪種效果就接哪一個,也可以同時使用(例如 combo 里程碑同時
// 觸發 FxManager 的文字浮現 + ParticleManager 的碎屑噴發)。
//
// 效能設計(這是這個系統跟其他 Phase 4/5/6 系統不同、刻意補上的部分——
// `game/PlayScene.jsx` 開頭註解承認「沒有做效能優化(每幀 setState 強制
// 重繪)」,這裡不重蹈覆轍):維護一個「歸還池」(_pool),粒子死亡後不
// 丟棄物件,而是清空欄位放回池子;下次 spawn 優先從池子拿舊物件重填,
// 只有池子空了才真的 `new`,避免每幀大量 GC。
//
// Contract(跟 judge/gameEngine.js 的三條 Contract 精神一致,但這裡不是
// 判定核心,不需要嚴格套用):同一組 (state, dt) 呼叫 `update` 一定推進出
// 同一個結果——內部不偷偷呼叫 `Date.now()`,時間一律由呼叫端傳入的
// `now`/`dt` 決定;`spawn()` 本身允許呼叫端注入 `rand`(預設
// `Math.random`)取代亂數來源,方便測試/replay 用固定序列重現同一次噴發。

function defaultRand() {
  return Math.random();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

let seq = 0;
function nextId() {
  seq += 1;
  return `p${seq}`;
}

export class ParticleManager {
  constructor() {
    this._active = [];
    this._pool = [];
  }

  // 從歸還池借一個物件出來(沒有的話才真的 new),避免頻繁配置/GC。
  _acquire() {
    const p = this._pool.pop();
    if (p) return p;
    return {
      id: "", x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0,
      rotate: 0, vrotate: 0, size: 4, color: "#fff", ageMs: 0, lifeMs: 1,
    };
  }

  // 依給定的參數直接生一顆粒子(單位:x/y 為畫面座標系,由呼叫端定義;
  // vx/vy 為每秒位移量,gravity 為每秒 vy 增量,drag 為 0~1 每秒速度衰減比例)。
  spawnOne({ x, y, vx, vy, gravity = 0, drag = 0, rotate = 0, vrotate = 0, size = 4, color = "#fff", lifeMs = 500 }) {
    const p = this._acquire();
    p.id = nextId();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.gravity = gravity; p.drag = drag;
    p.rotate = rotate; p.vrotate = vrotate;
    p.size = size; p.color = color;
    p.ageMs = 0; p.lifeMs = Math.max(1, lifeMs);
    this._active.push(p);
    return p.id;
  }

  // 依 preset 設定值噴發 count 顆,角度/速度在範圍內均勻散開(用 rand() 決定
  // 每顆的角度/速度/存活時間微幅差異,製造自然感)。preset 形狀見 presets.js
  // 的 `PARTICLE_PRESETS`,這裡只負責讀欄位、不假設呼叫端一定用 preset。
  emit(x, y, cfg = {}, { rand = defaultRand } = {}) {
    const {
      count = 1,
      angleMin = 0, angleMax = Math.PI * 2,
      speedMin = 40, speedMax = 120,
      gravity = 0, drag = 0,
      sizeMin = 2, sizeMax = 5,
      lifeMsMin = 300, lifeMsMax = 500,
      colors = ["#fff"],
      vrotateMax = 0,
    } = cfg;
    const ids = [];
    for (let i = 0; i < count; i++) {
      const angle = lerp(angleMin, angleMax, rand());
      const speed = lerp(speedMin, speedMax, rand());
      const size = lerp(sizeMin, sizeMax, rand());
      const lifeMs = lerp(lifeMsMin, lifeMsMax, rand());
      const color = colors[Math.floor(rand() * colors.length) % colors.length];
      const vrotate = vrotateMax ? lerp(-vrotateMax, vrotateMax, rand()) : 0;
      ids.push(this.spawnOne({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity, drag, size, color, lifeMs, vrotate,
      }));
    }
    return ids;
  }

  // 推進所有存活粒子:位置依速度累加、速度依重力/摩擦力衰減、年齡累加。
  // dt 單位為秒(呼叫端自行把 rAF 的 deltaMs / 1000 傳進來)。純數學,
  // 不碰 DOM/React,同一組 (state, dt) 一定得到同一個結果。
  update(dt) {
    if (dt <= 0) return;
    for (let i = 0; i < this._active.length; i++) {
      const p = this._active[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.drag > 0) {
        const decay = Math.max(0, 1 - p.drag * dt);
        p.vx *= decay;
        p.vy *= decay;
      }
      p.rotate += p.vrotate * dt;
      p.ageMs += dt * 1000;
    }
  }

  // 把已經死亡(ageMs >= lifeMs)的粒子從 active 移除、歸還進 pool(swap-pop
  // 就地刪除,不重新配置整個陣列,維持 O(存活數) 而不是 O(歷史總數))。
  prune() {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      if (p.ageMs >= p.lifeMs) {
        this._active[i] = this._active[this._active.length - 1];
        this._active.pop();
        this._pool.push(p);
      }
    }
    return this._active;
  }

  // life 0~1(1=剛生成,0=即將消失),渲染端可以拿來算 opacity/scale。
  getActive() {
    return this._active.map((p) => ({
      id: p.id, x: p.x, y: p.y, size: p.size, color: p.color, rotate: p.rotate,
      life: Math.max(0, 1 - p.ageMs / p.lifeMs),
    }));
  }

  count() {
    return this._active.length;
  }

  poolSize() {
    return this._pool.length;
  }

  clear() {
    while (this._active.length) this._pool.push(this._active.pop());
  }
}

export function createParticleManager() {
  return new ParticleManager();
}
